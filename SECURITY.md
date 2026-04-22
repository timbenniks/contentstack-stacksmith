# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer at tbenniks@gmail.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive acknowledgment within 48 hours
4. A fix will be prioritized based on severity

## Scope

This project handles Contentstack management tokens and API keys. Security concerns include:

- Token exposure in error messages or logs
- Credential storage in state/artifact files
- Command injection via UID or field values
- Unsafe deserialization of remote schema data
