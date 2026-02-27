import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  family: 4, // Tenta forçar IPv4 para evitar bloqueio do Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    ciphers: "SSLv3",
    rejectUnauthorized: false,
  },
  debug: true,
  logger: true,
  connectionTimeout: 15000, // Aumentei um pouco para dar fôlego ao servidor
});

// Teste de conexão
transporter.verify(function (error, success) {
  if (error) {
    console.log("Erro na configuração do email:", error);
  } else {
    console.log("Servidor pronto para enviar mensagens!");
  }
});
