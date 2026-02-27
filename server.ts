import express from "express";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const USERS_FILE = path.join(process.cwd(), "users.json");
const JWT_SECRET = process.env.JWT_SECRET || "super-secret-key";

app.use(express.json());

// Helper to read/write users
const getUsers = () => {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
};

const saveUsers = (users: any[]) => {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Registration
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  const users = getUsers();

  if (users.find((u: any) => u.email === email)) {
    return res.status(400).json({ message: "이미 가입된 이메일입니다." });
  }

  if (users.find((u: any) => u.username === username)) {
    return res.status(400).json({ message: "이미 사용 중인 ID입니다." });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

  const newUser = {
    username,
    email,
    password: hashedPassword,
    verified: false,
    verificationToken,
  };

  users.push(newUser);
  saveUsers(users);

  // Send verification email
  const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify?token=${verificationToken}`;
  console.log("Verification URL:", verificationUrl);
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "[마취사냥꾼] 이메일 인증을 완료해주세요",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
        <h2 style="color: #1e293b;">마취사냥꾼 가입을 환영합니다!</h2>
        <p style="color: #475569;">아래 버튼을 클릭하여 이메일 인증을 완료해주세요.</p>
        <a href="${verificationUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">이메일 인증하기</a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">본인이 가입한 것이 아니라면 이 메일을 무시하셔도 됩니다.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(201).json({ message: "인증 메일이 발송되었습니다. 이메일을 확인해주세요." });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ message: "인증 메일 발송에 실패했습니다. 하지만 계정은 생성되었습니다. (개발 환경 확인 필요)" });
  }
});

// Verification
app.get("/api/auth/verify", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: "토큰이 없습니다." });

  try {
    const decoded = jwt.verify(token as string, JWT_SECRET) as { email: string };
    const users = getUsers();
    const user = users.find((u: any) => u.email === decoded.email);

    if (!user) return res.status(400).json({ message: "사용자를 찾을 수 없습니다." });
    
    user.verified = true;
    user.verificationToken = undefined;
    saveUsers(users);

    res.json({ message: "이메일 인증이 완료되었습니다. 이제 로그인할 수 있습니다." });
  } catch (error) {
    res.status(400).json({ message: "유효하지 않거나 만료된 토큰입니다." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  const { identifier, password } = req.body; // identifier can be email or username
  const users = getUsers();
  const user = users.find((u: any) => u.email === identifier || u.username === identifier);

  if (!user) return res.status(400).json({ message: "가입되지 않은 계정입니다." });
  if (!user.verified) return res.status(401).json({ message: "이메일 인증이 완료되지 않았습니다." });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "비밀번호가 일치하지 않습니다." });

  const token = jwt.sign({ email: user.email, username: user.username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, user: { email: user.email, username: user.username } });
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
