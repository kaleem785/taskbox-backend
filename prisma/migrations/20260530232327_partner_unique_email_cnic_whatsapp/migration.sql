-- CreateIndex
CREATE UNIQUE INDEX "partners_email_key" ON "partners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "partners_cnic_key" ON "partners"("cnic");

-- CreateIndex
CREATE UNIQUE INDEX "partners_whatsapp_key" ON "partners"("whatsapp");
