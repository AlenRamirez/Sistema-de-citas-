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
const sendConfirmationcorreoCc = async (to, nombre) => {
  try {
    // Validar que los parámetros estén presentes
    if (!to || !nombre) {
      console.warn('Email o nombre no proporcionados para envío de confirmación');
      return;
    }

    // Validar que el transporter esté configurado
    if (!transporter) {
      console.warn('Transporter de email no está configurado');
      return;
    }

    const mailOptions = {
      from: `"Citas Médicas SENA" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: 'Confirmación de su cita médica',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c5aa0;">Confirmación de Cita Médica</h2>
          <p>Hola <strong>${nombre}</strong>,</p>
          <p>Su cita ha sido agendada con éxito.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <p><strong>Importante:</strong> Si desea cancelar su cita, debe hacerlo con al menos 24 horas de antelación.</p>
          </div>
          <p>Saludos cordiales,<br><strong>Citas Médicas SENA</strong></p>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email de confirmación enviado exitosamente:', result.messageId);

  } catch (error) {
    // No lanzar el error para que no afecte el agendamiento de la cita
    console.error('Error al enviar email de confirmación:', error.message);

    // Opcional: podrías registrar este error en una tabla de logs
    // await logEmailError(to, error.message);
  }
};
module.exports = { sendConfirmationcorreo, sendRecoveryEmail, sendConfirmationcorreoCc };



