import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "avipatel4love6@gmail.com",
      pass: "xcoeqouudjuaceex",
    },
  });

export default transporter;
