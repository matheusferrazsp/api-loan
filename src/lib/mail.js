import nodemailer from "nodemailer";

import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true para porta 465 (SSL)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Lembre-se: Senha de App de 16 dígitos
  },
  tls: {
    // Essencial para evitar falhas de handshake em servidores Linux/Docker
    rejectUnauthorized: false,
  },
  // Define tempos curtos para o servidor não ficar travado se o Gmail demorar
  connectionTimeout: 10000, // 10 segundos
  greetingTimeout: 5000,
  socketTimeout: 15000,
});

// Teste de conexão
transporter.verify(function (error, success) {
  if (error) {
    console.log("Erro na configuração do email:", error);
  } else {
    console.log("Servidor pronto para enviar mensagens!");
  }
});
