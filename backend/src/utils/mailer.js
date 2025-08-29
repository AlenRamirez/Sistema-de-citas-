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
    from: `"Citas Médicas" <${process.env.EMAIL_USER}>`,
    to: to,
    subject: '✅ Confirmación de registro',
    html: `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f6f8;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: #7fb0f8ff;
          color: #ffffff;
          text-align: center;
          padding: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
        }
        .content {
          padding: 30px;
          color: #333333;
          line-height: 1.6;
        }
        .btn {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 24px;
          background: #0d6efd;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
        }
        .footer {
          background: #f1f1f1;
          text-align: center;
          padding: 15px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Citas Médicas Sena</h1>
        </div>
        <div class="content">
          <p>👋 Hola <strong>${nombre}</strong>,</p>
          <p>Gracias por registrarte. Tu cuenta ha sido creada correctamente y ya puedes acceder a nuestro sistema de <strong>Citas Médicas</strong>.</p>
    
          <p style="margin-top: 30px;">Si no solicitaste este registro, por favor ignora este correo.</p>
          <p>Saludos,<br><strong>Equipo Citas Médicas Sena</strong></p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} Citas Médicas Sena - Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

const sendRecoveryEmail = async (to, nombre, link) => {
  const mailOptions = {
    from: `"Citas Médicas" <${process.env.EMAIL_USER}>`,
    to,
    subject: '🔐 Recuperación de contraseña',
    html: `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f4f6f8;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .header {
          background: #dc3545;
          color: #ffffff;
          text-align: center;
          padding: 20px;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
        }
        .content {
          padding: 30px;
          color: #333333;
          line-height: 1.6;
        }
        .btn {
          display: inline-block;
          margin-top: 20px;
          padding: 12px 24px;
          background: #dc3545;
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
        }
        .footer {
          background: #f1f1f1;
          text-align: center;
          padding: 15px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Recuperación de Contraseña</h1>
        </div>
        <div class="content">
          <p>👋 Hola <strong>${nombre}</strong>,</p>
          <p>Hemos recibido una solicitud para restablecer tu contraseña en <strong>Citas Médicas</strong>.</p>
          <p>Para continuar, haz clic en el siguiente botón:</p>
          <a href="${link}" class="btn">Restablecer contraseña</a>
          <p style="margin-top: 30px;">⚠️ Este enlace expirará en <strong>1 hora</strong>.  
          Si no solicitaste el restablecimiento de tu contraseña, puedes ignorar este correo.</p>
          <p>Saludos,<br><strong>Equipo Citas Médicas Sena</strong></p>
        </div>
        <div class="footer">
          © ${new Date().getFullYear()} Citas Médicas Sena - Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

const sendConfirmationcorreoCc = async (to, nombre) => {
  try {
    if (!to || !nombre) {
      console.warn('Email o nombre no proporcionados para envío de confirmación');
      return;
    }

    if (!transporter) {
      console.warn('Transporter de email no está configurado');
      return;
    }

    const mailOptions = {
      from: `"Citas Médicas SENA" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '✅ Confirmación de su cita médica',
      html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .header {
            background: #0d6efd;
            color: #ffffff;
            text-align: center;
            padding: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 22px;
          }
          .content {
            padding: 30px;
            color: #333333;
            line-height: 1.6;
          }
          .alert {
            background: #f8f9fa;
            padding: 15px;
            border-left: 5px solid #0d6efd;
            border-radius: 8px;
            margin: 20px 0;
            color: #444;
            font-size: 14px;
          }
          .footer {
            background: #f1f1f1;
            text-align: center;
            padding: 15px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Confirmación de Cita Médica</h1>
          </div>
          <div class="content">
            <p>👋 Hola <strong>${nombre}</strong>,</p>
            <p>Nos complace informarte que tu <strong>cita médica</strong> ha sido agendada con éxito.</p>

            <div class="alert">
              <strong>Importante:</strong>  
              Si deseas cancelar tu cita, recuerda hacerlo con al menos <strong>24 horas de antelación</strong>.
            </div>

            <p>Te esperamos puntual en tu cita.  
            <br>Saludos cordiales,  
            <strong>Citas Médicas SENA</strong></p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Citas Médicas SENA - Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email de confirmación enviado exitosamente:', result.messageId);

  } catch (error) {
    console.error('Error al enviar email de confirmación:', error.message);
  }
};
const CancelcitascorreoCc = async (to, nombre) => {
  try {
    if (!to || !nombre) {
      console.warn('Email o nombre no proporcionados para envío de cancelación');
      return;
    }

    if (!transporter) {
      console.warn('Transporter de email no está configurado');
      return;
    }

    const mailOptions = {
      from: `"Citas Médicas SENA" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: '❌ Cancelación de su cita médica',
      html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f6f8;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 30px auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .header {
            background: #dc3545;
            color: #ffffff;
            text-align: center;
            padding: 20px;
          }
          .header h1 {
            margin: 0;
            font-size: 22px;
          }
          .content {
            padding: 30px;
            color: #333333;
            line-height: 1.6;
          }
          .alert {
            background: #f8f9fa;
            padding: 15px;
            border-left: 5px solid #dc3545;
            border-radius: 8px;
            margin: 20px 0;
            color: #444;
            font-size: 14px;
          }
          .footer {
            background: #f1f1f1;
            text-align: center;
            padding: 15px;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Cancelación de Cita Médica</h1>
          </div>
          <div class="content">
            <p>👋 Hola <strong>${nombre}</strong>,</p>
            <p>Lamentamos informarte que tu <strong>cita médica</strong> ha sido cancelada.</p>

            <div class="alert">
              <strong>Importante:</strong><br>
              Si tienes dudas o necesitas reprogramar tu cita, por favor contacta al administrador.
            </div>

            <p>Saludos cordiales,<br>
            <strong>Citas Médicas SENA</strong></p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Citas Médicas SENA - Todos los derechos reservados.
          </div>
        </div>
      </body>
      </html>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email de cancelación enviado exitosamente:', result.messageId);

  } catch (error) {
    console.error('Error al enviar email de cancelación:', error.message);
  }
};
module.exports = { sendConfirmationcorreo, sendRecoveryEmail, sendConfirmationcorreoCc, CancelcitascorreoCc };