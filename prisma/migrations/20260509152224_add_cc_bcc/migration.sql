-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "odooUrl" TEXT NOT NULL DEFAULT '',
    "odooUsername" TEXT NOT NULL DEFAULT '',
    "odooPassword" TEXT NOT NULL DEFAULT '',
    "odooDatabase" TEXT NOT NULL DEFAULT '',
    "emailRecipients" TEXT NOT NULL DEFAULT '',
    "emailCc" TEXT NOT NULL DEFAULT '',
    "emailBcc" TEXT NOT NULL DEFAULT '',
    "emailFrom" TEXT NOT NULL DEFAULT '',
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "smtpPassword" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("emailFrom", "emailRecipients", "id", "odooDatabase", "odooPassword", "odooUrl", "odooUsername", "smtpHost", "smtpPassword", "smtpPort", "smtpUser", "userId") SELECT "emailFrom", "emailRecipients", "id", "odooDatabase", "odooPassword", "odooUrl", "odooUsername", "smtpHost", "smtpPassword", "smtpPort", "smtpUser", "userId" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
