// api/send-email.js
const nodemailer = require("nodemailer");
const https = require("https");

const allowCors = (fn) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  return fn(req, res);
};

const getQrBuffer = (code) =>
  new Promise((resolve, reject) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(code)}`;
    https
      .get(url, (resp) => {
        if (resp.statusCode !== 200) {
          return reject(new Error(`QR HTTP ${resp.statusCode}`));
        }
        const chunks = [];
        resp.on("data", (c) => chunks.push(c));
        resp.on("end", () => resolve(Buffer.concat(chunks)));
        resp.on("error", reject);
      })
      .on("error", reject)
      .setTimeout(8000, function () {
        this.destroy(new Error("QR timeout"));
      });
  });

const isValidEmail = (e) =>
  typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const handler = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const body = req.body || {};
  const to = (body.to || "").trim();
  const nomeAlunoRaw = (body.nomeAluno || "").trim();
  const code = (body.code || "").trim();
  const lote = (body.lote || "Ingresso").toString();
  const preco = (body.preco || "").toString();

  if (!isValidEmail(to)) {
    console.error("send-email: e-mail inválido", { to, code });
    return res.status(400).json({ error: "E-mail do destinatário inválido", to });
  }
  if (!code) {
    console.error("send-email: code ausente", { to });
    return res.status(400).json({ error: "Código do ingresso ausente" });
  }

  const nomeAluno = nomeAlunoRaw || "Convidado";
  const primeiroNome = nomeAluno.split(/\s+/)[0] || "Convidado";
  const dataEvento = "27 de Junho de 2026";

  let qrBuffer = null;
  try {
    qrBuffer = await getQrBuffer(code);
  } catch (e) {
    console.warn("send-email: erro ao gerar QR", e.message);
  }

  // Verifica variáveis de ambiente (SMTP_USER e SMTP_PASS — Hostinger)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("send-email: SMTP_USER/SMTP_PASS não configurados");
    return res.status(500).json({ error: "Servidor de e-mail não configurado" });
  }

  // Configuração SMTP do Hostinger
  const transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true, // SSL na porta 465
    auth: {
      user: process.env.SMTP_USER, // ex: contato@seudominio.com.br
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
    <div style="font-family:Arial,sans-serif;background:#000000;color:#ffffff;padding:32px;max-width:500px;margin:auto;border-radius:16px">
      <h1 style="font-size:22px;margin-bottom:4px;color:#ffffff">🎉 Ingresso Confirmado!</h1>
      <p style="color:#888888;margin:0 0 24px">Festa Junina Brandão — ${dataEvento}</p>
      <div style="background:#111111;border:1px solid #333333;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        ${
          qrBuffer
            ? `<img src="cid:qrcode@festa" width="180" height="180" style="background:#ffffff;padding:8px;border-radius:8px;display:block;margin:0 auto"/>`
            : `<p style="color:#fff">QR Code indisponível — apresente o código abaixo na portaria.</p>`
        }
        <p style="color:#999999;font-size:11px;margin:12px 0 4px;text-transform:uppercase;letter-spacing:2px">Código do Ingresso</p>
        <p style="font-size:26px;font-weight:bold;font-family:monospace;margin:0;color:#ffffff">${code}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="color:#888888;padding:10px 0;border-bottom:1px solid #222">Aluno</td><td style="color:#fff;text-align:right;padding:10px 0;border-bottom:1px solid #222">${nomeAluno}</td></tr>
        <tr><td style="color:#888888;padding:10px 0;border-bottom:1px solid #222">Lote</td><td style="color:#fff;text-align:right;padding:10px 0;border-bottom:1px solid #222">${lote}</td></tr>
        <tr><td style="color:#888888;padding:10px 0;border-bottom:1px solid #222">Valor pago</td><td style="color:#fff;text-align:right;padding:10px 0;border-bottom:1px solid #222">${preco}</td></tr>
        <tr><td style="color:#888888;padding:10px 0">Válido para</td><td style="color:#fff;text-align:right;padding:10px 0">${dataEvento}</td></tr>
      </table>
      <div style="background:#111;border:1px solid #333;border-radius:8px;padding:16px;font-size:13px;color:#aaa;line-height:1.8">
        <strong style="color:#fff">📋 Instruções</strong><br/><br/>
        • Apresente o QR Code acima na entrada do evento<br/>
        • O ingresso é nominal e intransferível<br/>
        • Em caso de dúvidas, guarde este e-mail<br/>
        • Não compartilhe seu código com ninguém
      </div>
      <p style="color:#555;font-size:11px;text-align:center;margin-top:24px">Festa Junina Brandão · ${process.env.SMTP_USER}</p>
    </div>`;

  try {
    const info = await transporter.sendMail({
      from: `"Festa Junina Brandão" <${process.env.SMTP_USER}>`,
      to,
      subject: `${primeiroNome}, seu ingresso chegou! 🎉`,
      html,
      attachments: qrBuffer
        ? [{ filename: "qrcode.png", content: qrBuffer, cid: "qrcode@festa" }]
        : [],
    });
    console.log("send-email: enviado com sucesso", { to, code, id: info.messageId });
    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("send-email: erro nodemailer", { to, code, msg: err.message });
    return res.status(500).json({ error: err.message, to, code });
  }
};

module.exports = allowCors(handler);
