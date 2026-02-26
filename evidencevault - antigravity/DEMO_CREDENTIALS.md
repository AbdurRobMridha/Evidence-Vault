# Demo Credentials for Testing

## Quick Start

For testing purposes, you can use the following demo accounts. These credentials are pre-configured in the login page for easy access.

### Demo Account 1: Regular User (Victim)
- **Email:** `victim@example.com`
- **Password:** `password`
- **Role:** User
- **Access:** Can create cases and upload evidence

### Demo Account 2: Admin User (Authority)
- **Email:** `authority@police.gov`
- **Password:** `password`
- **Role:** Admin
- **Access:** Can access Authority Dashboard and view escalated cases

## How to Create These Accounts

### Option 1: Using the Sign Up Form (Recommended)
1. Open the login page
2. Click "Sign Up" toggle
3. Enter email: `victim@example.com` (or `authority@police.gov`)
4. Enter password: `password`
5. Click "Create Account"
6. Repeat for the second account

### Option 2: Quick Demo Account Buttons
On the login page, click one of the demo account buttons at the bottom:
- "User (Victim)" - Auto-fills `victim@example.com` with password
- "Admin (Authority)" - Auto-fills `authority@police.gov` with password

Then just click "Sign Up" if the account doesn't exist yet, or "Secure Login" if it does.

## Features to Test

### Regular User (victim@example.com)
- ✅ Create new cases
- ✅ Upload evidence files with SHA-256 verification
- ✅ View case details and evidence
- ✅ Configure dead-man switch settings
- ✅ Export cases as ZIP archives
- ✅ View audit logs

### Admin User (authority@police.gov)
- ✅ All user features
- ✅ Access Authority Dashboard
- ✅ View escalated cases from dead-man switch
- ✅ Monitor all uploaded evidence
- ✅ Review audit trails

## Testing Workflow

1. **Sign up** with the demo credentials
2. **Create a case** with title and description (AI will analyze risk)
3. **Upload evidence** - The system will verify file integrity
4. **Configure dead-man switch** - Set your check-in interval
5. **Export case** - Download as ZIP with metadata and audit logs
6. **Logout** - Use the logout button in the sidebar

## Note

These are demo credentials for development and testing only. In production, use proper authentication methods and secure password management.
