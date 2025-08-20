const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendConfirmationcorreo = async (to, nombre) => {
  const mailOptions = {
    from: `"Citas medicas" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Confirmación de registro',
    html: `<p>Hola ${nombre},</p>
           <p>Gracias por registrarte. Tu cuenta ha sido creada correctamente.</p>
           <p>Saludos,<br>Citas medicas Sena</p>`

  };

  await transporter.sendMail(mailOptions);
};
const sendRecoveryEmail = async (to, nombre, link) => {
  const mailOptions = {
    from: `"Citas médicas" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Recuperación de contraseña',
    html: `<p>Hola ${nombre},</p>
           <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
           <a href="${link}">${link}</a>
           <p>Este enlace expirará en 1 hora.</p>`
  };

  await transporter.sendMail(mailOptions);
};
module.exports = { sendConfirmationcorreo, sendRecoveryEmail };



