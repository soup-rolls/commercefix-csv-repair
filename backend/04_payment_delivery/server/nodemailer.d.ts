declare module "nodemailer" {
  export type Transporter = {
    verify(): Promise<unknown>;
    sendMail(message: {
      from: string;
      to: string;
      replyTo?: string;
      subject: string;
      text: string;
      html: string;
      attachments?: Array<{
        filename: string;
        path: string;
        contentType?: string;
      }>;
    }): Promise<unknown>;
  };

  export function createTransport(options: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    proxy?: string;
  }): Transporter;
}
