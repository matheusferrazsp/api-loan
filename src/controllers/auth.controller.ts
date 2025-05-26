import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import { generateToken } from "../utils/generateToken";
import { registerSchema, loginSchema } from "../schemas/auth.schema";

export const register = async (req: Request, res: Response) => {
  try {
    const { nome, email, senha } = registerSchema.parse(req.body);

    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ erro: "Email já cadastrado" });

    const hashedPassword = await bcrypt.hash(senha, 10);
    const newUser = await User.create({ nome, email, senha: hashedPassword });

    return res.status(201).json({
      _id: newUser._id,
      nome: newUser.nome,
      email: newUser.email,
      token: generateToken(newUser._id.toString()),
    });
  } catch (err: any) {
    return res
      .status(400)
      .json({ erro: err.errors?.[0]?.message || err.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ erro: "Usuário não encontrado" });

    const isMatch = await bcrypt.compare(senha, user.senha);
    if (!isMatch) return res.status(401).json({ erro: "Senha incorreta" });

    return res.json({
      _id: user._id,
      nome: user.nome,
      email: user.email,
      token: generateToken(user._id.toString()),
    });
  } catch (err: any) {
    return res
      .status(400)
      .json({ erro: err.errors?.[0]?.message || err.message });
  }
};
