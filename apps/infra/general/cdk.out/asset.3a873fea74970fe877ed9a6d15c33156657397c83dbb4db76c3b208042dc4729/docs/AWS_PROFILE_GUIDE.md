## Using AWS Profile With Your Project

All AWS scripts and Makefile commands now use the `AWS_PROFILE` environment variable instead of hardcoded profile names.

### Quick Setup

```bash
# Set your AWS profile (do this in your shell or add to ~/.bashrc/.zshrc)
export AWS_PROFILE=myprofile

# Verify it works
make check-env

# Initialize environment
make aws-init ENV=dev
```

### How It Works

**Default Behavior:**
- If `AWS_PROFILE` is not set, scripts default to `default`
- All Makefile commands use `${AWS_PROFILE:-default}`

**Override Examples:**
```bash
# Using environment variable (recommended)
export AWS_PROFILE=production
make aws-status

# Or pass directly to scripts
./scripts/aws/db-commands.sh status production

# Or one-off override
AWS_PROFILE=staging make aws-backup
```

### What Changed

✅ Removed all hardcoded usernames references
✅ Scripts now respect `AWS_PROFILE` environment variable
✅ Default to `default` profile if not set
✅ All documentation uses generic profile names
✅ Makefile uses `${AWS_PROFILE:-default}` throughout

### Setup for Your Profile

```bash
# Add to ~/.zshrc or ~/.bash_profile
export AWS_PROFILE={YOUR_PROFILE}

# Then reload shell
source ~/.zshrc

# Verify
make check-env
```

### For Different Teams/Accounts

Each team member can set their own profile:

```bash
# Team member 1
export AWS_PROFILE=dev-account

# Team member 2
export AWS_PROFILE=prod-account

# They can all use the same commands
make aws-status
make deploy-dev
```

### CI/CD Integration

GitHub Actions automatically uses the AWS role from secrets - no profile needed there.

---

✅ **No more hardcoded credentials or profile names in the codebase!**
