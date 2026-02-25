export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply
      .status(401)
      .send({ error: "Não autorizado. Token inválido ou ausente." });
  }
}
