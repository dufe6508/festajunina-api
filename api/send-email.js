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
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(code)}`;
    https.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
  });

const handler = async (req, res) => {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método não permitido" });

  const { to, nomeAluno, code, lote, preco } = req.body;
  const dataEvento = "21 de Junho de 2025";
  const primeiroNome = nomeAluno.trim().split(" ")[0];

  let qrBuffer = null;
  try {
    qrBuffer = await getQrBuffer(code);
  } catch (e) {
    console.warn("Erro ao gerar QR:", e);
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5;">
          
          <!-- Header -->
          <tr>
            <td style="background:#1a1a1a;padding:28px 32px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#999999;letter-spacing:3px;text-transform:uppercase;">Festa Junina</p>
              <h1 style="margin:6px 0 0;font-size:24px;color:#ffffff;font-weight:bold;">Colégio Brandão</h1>
            </td>
          </tr>

          <!-- Título -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <p style="margin:0;font-size:28px;">🎉</p>
              <h2 style="margin:8px 0 4px;font-size:22px;color:#1a1a1a;">${primeiroNome}, seu ingresso chegou!</h2>
              <p style="margin:0;font-size:14px;color:#888888;">${dataEvento}</p>
            </td>
          </tr>

          <!-- QR Code -->
          <tr>
            <td style="padding:28px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;background:#f9f9f9;border:1px solid #e5e5e5;border-radius:12px;padding:20px;">
                <tr>
                  <td align="center">
                    <img src="cid:qrcode@festa" width="180" height="180" style="display:block;"/>
                    <p style="margin:14px 0 2px;font-size:10px;color:#aaaaaa;letter-spacing:2px;text-transform:uppercase;">Código do Ingresso</p>
                    <p style="margin:0;font-size:22px;font-weight:bold;font-family:monospace;color:#1a1a1a;">${code}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Detalhes -->
          <tr>
            <td style="padding:0 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">
                <tr style="background:#f9f9f9;">
                  <td style="padding:12px 16px;font-size:13px;color:#888888;">Aluno</td>
                  <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:right;font-weight:600;">${nomeAluno}</td>
                </tr>
                <tr style="border-top:1px solid #e5e5e5;">
                  <td style="padding:12px 16px;font-size:13px;color:#888888;">Lote</td>
                  <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:right;font-weight:600;">${lote}</td>
                </tr>
                <tr style="background:#f9f9f9;border-top:1px solid #e5e5e5;">
                  <td style="padding:12px 16px;font-size:13px;color:#888888;">Valor pago</td>
                  <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:right;font-weight:600;">${preco}</td>
                </tr>
                <tr style="border-top:1px solid #e5e5e5;">
                  <td style="padding:12px 16px;font-size:13px;color:#888888;">Data do evento</td>
                  <td style="padding:12px 16px;font-size:13px;color:#1a1a1a;text-align:right;font-weight:600;">${dataEvento}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Instruções -->
          <tr>
            <td style="padding:0 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
                <tr>
                  <td>
                    <p style="margin:0 0 8px;font-size:13px;font-weight:bold;color:#92400e;">📋 Instruções</p>
                    <p style="margin:0;font-size:13px;color:#78350f;line-height:1.8;">
                      • Apresente o QR Code na entrada do evento<br/>
                      • O ingresso é nominal e intransferível<br/>
                      • Guarde este e-mail como comprovante<br/>
                      • Não compartilhe seu código com ninguém
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border-top:1px solid #e5e5e5;padding:20px 32px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;">
                Festa Junina Brandão · ${dataEvento}<br/>
                <a href="mailto:ingressobrandao@gmail.com" style="color:#aaaaaa;">ingressobrandao@gmail.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"Festa Junina Brandão" <${process.env.GMAIL_USER}>`,
      to,
      subject: `${primeiroNome}, seu ingresso chegou! 🎉`,
      html,
      attachments: qrBuffer
        ? [{ filename: "qrcode.png", content: qrBuffer, cid: "qrcode@festa" }]
        : [],
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro ao enviar e-mail:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = allowCors(handler);
