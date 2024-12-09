import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "",
      pass: "",
    },
  });

export default transporter;
