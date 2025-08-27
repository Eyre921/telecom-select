/*
  Warnings:

  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Organization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserOrganization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserOrganization_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PhoneNumber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "premiumReason" TEXT,
    "reservationStatus" TEXT NOT NULL DEFAULT 'UNRESERVED',
    "orderTimestamp" DATETIME,
    "paymentAmount" REAL,
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "assignedMarketer" TEXT,
    "customerName" TEXT,
    "customerContact" TEXT,
    "shippingAddress" TEXT,
    "emsTrackingNumber" TEXT,
    "deliveryStatus" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "schoolId" TEXT,
    "departmentId" TEXT,
    CONSTRAINT "PhoneNumber_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PhoneNumber_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PhoneNumber" ("assignedMarketer", "createdAt", "customerContact", "customerName", "deliveryStatus", "emsTrackingNumber", "id", "isPremium", "orderTimestamp", "paymentAmount", "paymentMethod", "phoneNumber", "premiumReason", "reservationStatus", "shippingAddress", "transactionId", "updatedAt") SELECT "assignedMarketer", "createdAt", "customerContact", "customerName", "deliveryStatus", "emsTrackingNumber", "id", "isPremium", "orderTimestamp", "paymentAmount", "paymentMethod", "phoneNumber", "premiumReason", "reservationStatus", "shippingAddress", "transactionId", "updatedAt" FROM "PhoneNumber";
DROP TABLE "PhoneNumber";
ALTER TABLE "new_PhoneNumber" RENAME TO "PhoneNumber";
CREATE UNIQUE INDEX "PhoneNumber_phoneNumber_key" ON "PhoneNumber"("phoneNumber");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "password" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SALES_USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("email", "emailVerified", "id", "image", "name", "password", "role") SELECT "email", "emailVerified", "id", "image", "name", "password", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserOrganization_userId_organizationId_key" ON "UserOrganization"("userId", "organizationId");
