import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Porta 465 exige secure: true
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // Opcional: Garante que o Node não rejeite o certificado do servidor do Railway
  tls: {
    rejectUnauthorized: false,
  },
});
