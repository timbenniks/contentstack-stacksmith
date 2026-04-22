import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export class PromptService {
  async confirm(message: string, options: { ci?: boolean; yes?: boolean }): Promise<boolean> {
    if (options.ci || options.yes) return true;

    const readline = createInterface({ input, output });
    const answer = await readline.question(`${message} [y/N] `);
    readline.close();
    return ["y", "yes"].includes(answer.trim().toLowerCase());
  }

  async ask(message: string, options: { ci?: boolean; defaultValue?: string }): Promise<string> {
    if (options.ci && options.defaultValue) return options.defaultValue;

    const readline = createInterface({ input, output });
    const suffix = options.defaultValue ? ` (${options.defaultValue})` : "";
    const answer = await readline.question(`${message}${suffix}: `);
    readline.close();
    return answer.trim() || options.defaultValue || "";
  }

  /**
   * Prompt for a secret with masked input. Characters typed are echoed as "*".
   * Backspace and Ctrl-C behave sensibly. Never logged; the returned string lives in memory only.
   *
   * Returns "" if stdin is not a TTY (caller is expected to check isTTY up front, but we fail safe).
   */
  async promptForToken(message: string): Promise<string> {
    if (!input.isTTY) return "";

    output.write(`${message}: `);

    const wasRaw = input.isRaw;
    input.setRawMode?.(true);
    input.resume();
    input.setEncoding("utf8");

    return new Promise<string>((resolve, reject) => {
      let buffer = "";

      const onData = (chunk: string): void => {
        for (const ch of chunk) {
          const code = ch.charCodeAt(0);
          if (code === 0x03) {
            cleanup();
            output.write("\n");
            reject(new Error("Cancelled"));
            return;
          }
          if (code === 0x0d || code === 0x0a) {
            cleanup();
            output.write("\n");
            resolve(buffer);
            return;
          }
          if (code === 0x7f || code === 0x08) {
            if (buffer.length > 0) {
              buffer = buffer.slice(0, -1);
              output.write("\b \b");
            }
            continue;
          }
          if (code < 0x20) continue;
          buffer += ch;
          output.write("*");
        }
      };

      const cleanup = (): void => {
        input.off("data", onData);
        input.setRawMode?.(wasRaw);
        input.pause();
      };

      input.on("data", onData);
    });
  }
}
