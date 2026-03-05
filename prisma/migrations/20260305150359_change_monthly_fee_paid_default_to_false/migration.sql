/*
  Warnings:

  - You are about to alter the column `lastPaymentAmount` on the `Client` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "lastPaymentAmount" SET DATA TYPE DECIMAL(10,2);
