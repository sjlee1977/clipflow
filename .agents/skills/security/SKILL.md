---
name: security-and-privacy
description: Essential security and privacy guidelines for ClipFlow - Never expose sensitive keys.
---

# Security & Privacy Guidelines (ClipFlow)

This document serves as a mandatory behavioral guideline for any AI assistant working on the ClipFlow project. It focuses on preventing accidental exposure of sensitive information in the chat window.

## 🚫 Primary Directive: No Secrets in Chat
The following information must **NEVER** be printed or exposed in the chat window:
- **AWS Access Keys**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- **Supabase Keys**: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Any API Keys**: Google, OpenAI, etc.
- **Any Passwords or Secrets** found in `.env.local` or other environment files.

## 🛡️ Best Practices for AI Interaction
1.  **Mask Sensitive Values**: If you must refer to a specific environment variable, show only the Key name (e.g., `AWS_ACCESS_KEY_ID`) and never its Value. Use `***` for masking if necessary.
2.  **Shell Command Safety**: Do not provide terminal commands that include plaintext secrets. Instead, advise the user that the environment variables will be picked up by the tool or ask them to set them in their local shell environment silently.
3.  **Proactive Security Advice**: If you suspect a key has been leaked (e.g., if it was previously exposed in a log or a message), immediately advise the user to **Rotate (Regenerate)** the key.
4.  **Sensitive File Handling**: Always treat `.env.local`, `.env`, and any files containing credentials as "Sensitive Files". Do not summarize their contents in a way that reveals secrets.

---
**FAILURE TO ADHERE TO THESE GUIDELINES IS A CRITICAL SECURITY VIOLATION.**
