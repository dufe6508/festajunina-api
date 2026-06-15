const nodemailer = require("nodemailer");
const https = require("https");

const allowCors = (fn) => async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  return fn(req, res);
};

const getQrBase64 = (code) =>
  new Promise((resolve, reject) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`;
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      res.on("error", reject);
    });
  });

const handler = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const { to, nomeAluno, code, lote, preco } = req.body;
  const dataEvento = "21 de Junho de 2025";

  let qrBase64 = "";
  try {
    qrBase64 = await getQrBase64(code);
  } catch (e) {
    console.warn("Erro ao gerar QR base64:", e);
  }

  // QR Code embutido diretamente no src como base64
  const qrSrc = qrBase64
    ? `data:image/png;base64,${qrBase64}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(code)}`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const html = `
    <div style="font-family:Arial,sans-serif;background:#000000;color:#ffffff;padding:32px;max-width:500px;margin:auto;border-radius:16px">
      <h1 style="font-size:22px;margin-bottom:4px;color:#ffffff">🎉 Ingresso Confirmado!</h1>
      <p style="color:#888888;margin:0 0 24px">Festa Junina Brandão — ${dataEvento}</p>

      <div style="background:#111111;border:1px solid #333333;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <img src="${qrSrc}" width="180" height="180"
          style="background:#ffffff;padding:8px;border-radius:8px;display:block;margin:0 auto"/>
        <p style="color:#999999;font-size:11px;margin:12px 0 4px;text-transform:uppercase;letter-spacing:2px">Código do Ingresso</p>
        <p style="font-size:26px;font-weight:bold;font-family:monospace;margin:0;color:#ffffff">${code}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="color:#888888;padding:10px 0;border-bottom:1px solid #222222">Aluno</td>
          <td style="color:#ffffff;text-align:right;padding:10px 0;border-bottom:1px solid #222222">${nomeAluno}</td>
        </tr>
        <tr>
          <td style="color:#888888;padding:10px 0;border-bottom:1px solid #222222">Lote</td>
          <td style="color:#ffffff;text-align:right;padding:10px 0;border-bottom:1px solid #222222">${lote}</td>
        </tr>
        <tr>
          <td style="color:#888888;padding:10px 0;border-bottom:1px solid #222222">Valor pago</td>
          <td style="color:#ffffff;text-align:right;padding:10px 0;border-bottom:1px solid #222222">${preco}</td>
        </tr>
        <tr>
          <td style="color:#888888;padding:10px 0">Válido para</td>
          <td style="color:#ffffff;text-align:right;padding:10px 0">${dataEvento}</td>
        </tr>
      </table>

      <div style="background:#111111;border:1px solid #333333;border-radius:8px;padding:16px;font-size:13px;color:#aaaaaa;line-height:1.8">
        <strong style="color:#ffffff">📋 Instruções</strong><br/><br/>
        • Apresente o QR Code acima na entrada do evento<br/>
        • O ingresso é nominal e intransferível<br/>
        • Em caso de dúvidas, guarde este e-mail<br/>
        • Não compartilhe seu código com ninguém
      </div>

      <p style="color:#555555;font-size:11px;text-align:center;margin-top:24px">
        Festa Junina Brandão · ingressobrandao@gmail.com
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Festa Junina Brandão" <${process.env.GMAIL_USER}>`,
      to,
      subject: `🎉 Seu ingresso chegou! ${code} — Festa Junina Brandão`,
      html,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = allowCors(handler);
