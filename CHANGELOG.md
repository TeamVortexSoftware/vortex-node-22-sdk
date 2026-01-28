# Changelog

All notable changes to the Vortex Node.js SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-01-23

### Added
- **Internal Invitations**: New `'internal'` delivery type for customer-managed invitations
  - Allows creating invitations with `deliveryTypes: ['internal']`
  - No email/SMS communication triggered by Vortex
  - Target value can be any customer-defined identifier (UUID, string, number)
  - Useful for in-app invitation flows managed by customer's application

### Changed
- Updated `deliveryTypes` type to include `'internal'` as a valid value: `('email' | 'phone' | 'share' | 'internal')[]`

## [0.1.4] - 2025-01-29

### Added
- **AcceptUser Type**: New preferred format for accepting invitations with `email`, `phone`, and `name` fields
- Enhanced `acceptInvitations` method to support both new User format and legacy target format

### Changed
- **DEPRECATED**: Legacy `InvitationTarget` format for `acceptInvitations` - use `AcceptUser` instead
- Internal API calls now always use User format for consistency
- Added console warnings when legacy target format is used

### Fixed
- Maintained 100% backward compatibility - existing code using legacy target format continues to work
