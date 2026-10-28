# Private Spaces

Use the **Space** selector on the homepage to switch between the public catalog and your accepted spaces. Search, filters and pagination stay within the selected space. Open **Private Spaces** from the navigation to create a personal space. A space without invited members is visible only to its owner. Space creation is available to authenticated users; creating apps still requires the existing app submission permission.

The space owner can rename a space or delete it with all contained private apps after confirmation. Published apps remain in the public catalog.

The space owner can invite existing, active accounts by email address. Invitations appear under **Private Spaces** in the invited account. Access begins after acceptance. The owner can remove members or cancel invitations, and members can leave the space.

Accepted members can see the space's apps, including drafts, and create their own apps. App ownership and editor permissions continue to control editing. Platform roles and app editor assignments alone do not grant access to another user's private space. An app's own owner retains access to that app if they leave the space.

To publish, the app owner selects **Für alle veröffentlichen** in the space and confirms the dialog. Description and category are required. Publication moves the app out of the space into the public catalog, clears the hidden flag, and changes a draft to **In Erprobung**. Its documentation, ratings and discussions become public with it. Ordinary edits cannot change the space assignment.

Private entries are excluded from the public catalog, MCP catalog, global FAQ and catalog stewardship. App-specific endpoints, AI retrieval, related-app results, health data and notification lists enforce space access. Backups include spaces and memberships with the apps section.

Database migration `62_create_private_spaces.go` adds spaces, invitations/memberships and the nullable `apps.space_id` reference. Existing apps remain in the public catalog.
