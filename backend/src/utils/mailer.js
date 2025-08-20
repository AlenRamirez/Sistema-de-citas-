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

const sendConfirmationEmail = async (to, nombre) => {
  const mailOptions = {
    from: `"CDMI" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: 'Confirmación de registro',
    html: `<p>Hola ${nombre},</p>
           <p>Gracias por registrarte. Tu cuenta ha sido creada correctamente.</p>
           <p>Saludos,<br>CDMI</p>`
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendConfirmationEmail };
