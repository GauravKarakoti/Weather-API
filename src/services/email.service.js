const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

const sendAdminAlert = async (failedSelectors) => {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn("Email config incomplete. Alert not sent.");
    return;
  }

  const message = `The following selectors failed: ${failedSelectors.join(", ")}`;

  try {
    await transporter.sendMail({
      from: `"Weather API Alert" <${process.env.MAIL_USER}>`,
      to: adminEmail,
      subject: "Selector Validation Failure",
      text: `${message}\nCheck your scraping logic.`,
      html: `<p><strong>Selectors Failed:</strong> ${message}</p><p>Please check and fix.</p>`,
    });
    console.log("Alert email sent.");
  } catch (err) {
    console.error("Failed to send alert email:", err.message);
  }
};

module.exports = { sendAdminAlert };
