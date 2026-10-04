const SibApiV3Sdk = require('sib-api-v3-sdk');

class EmailService {
  constructor() {
    // Configure Brevo client
    const client = SibApiV3Sdk.ApiClient.instance;
    client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
    this.emailApi = new SibApiV3Sdk.TransactionalEmailsApi();
  }

  /**
   * Generate a 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP email
   * @param {String} email - Recipient email
   * @param {String} otp - OTP code
   * @param {String} name - Recipient name (optional)
   */
  async sendOTPEmail(email, otp, name = 'User') {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL;
      const senderName = process.env.BREVO_SENDER_NAME;
      
      const response = await this.emailApi.sendTransacEmail({
        sender: {
          email: senderEmail,
          name: senderName
        },
        to: [{ email, name }],
        subject: 'Email Verification OTP - ThinkCivil IAS',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #2c3e50; margin-bottom: 10px;">ThinkCivil IAS</h2>
              <p style="color: #7f8c8d; font-size: 14px;">Email Verification</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; border: 1px solid #e9ecef;">
              <h3 style="color: #2c3e50; margin-bottom: 20px;">Verify Your Email</h3>
              <p style="color: #495057; margin-bottom: 20px;">
                Hello ${name},<br>
                Use the following OTP to complete your registration:
              </p>
              
              <div style="background: #ffffff; padding: 20px; border-radius: 8px; display: inline-block; margin: 20px 0; border: 2px dashed #4CAF50;">
                <div style="font-size: 32px; font-weight: bold; color: #4CAF50; letter-spacing: 8px; font-family: monospace;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
                This OTP is valid for 10 minutes.<br>
                Do not share this code with anyone.
              </p>
              
              <p style="color: #6c757d; font-size: 12px; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
                If you didn't request this, please ignore this email.<br>
                <strong>ThinkCivil IAS</strong> - Empowering Civil Service Aspirants.<br>
                Think better. Prepare smarter. Serve the nation.
              </p>
            </div>
          </div>
        `,
        textContent: `
          ThinkCivil IAS - Email Verification

          Hello ${name},

          Your verification code is: ${otp}

          This OTP is valid for 10 minutes.
          Do not share this code with anyone.

          If you didn't request this, please ignore this email.

          ThinkCivil IAS - Empowering Civil Service Aspirants.
          Think better. Prepare smarter. Serve the nation.
        `
      });

      console.log(`OTP email sent to ${email}: ${otp}`); // Remove in production
      return { success: true, messageId: response.messageId };
      
    } catch (error) {
      console.error('Error sending OTP email:', error);
      throw new Error('Failed to send OTP email');
    }
  }





  async sendPasswordResetOTP(email, otp, name = 'User') {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL;
      const senderName = process.env.BREVO_SENDER_NAME;
      
      const response = await this.emailApi.sendTransacEmail({
        sender: {
          email: senderEmail,
          name: senderName
        },
        to: [{ email, name }],
        subject: 'Password Reset OTP - ThinkCivil IAS',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #2c3e50; margin-bottom: 10px;">ThinkCivil IAS</h2>
              <p style="color: #7f8c8d; font-size: 14px;">Password Reset Request</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center; border: 1px solid #e9ecef;">
              <h3 style="color: #2c3e50; margin-bottom: 20px;">Reset Your Password</h3>
              <p style="color: #495057; margin-bottom: 20px;">
                Hello ${name},<br>
                We received a request to reset your password. Use the following OTP to proceed:
              </p>
              
              <div style="background: #ffffff; padding: 20px; border-radius: 8px; display: inline-block; margin: 20px 0; border: 2px dashed #ef4444;">
                <div style="font-size: 32px; font-weight: bold; color: #ef4444; letter-spacing: 8px; font-family: monospace;">
                  ${otp}
                </div>
              </div>
              
              <p style="color: #6c757d; font-size: 14px; margin-top: 20px;">
                This OTP is valid for 10 minutes.<br>
                Do not share this code with anyone.
              </p>
              
              <p style="color: #6c757d; font-size: 12px; margin-top: 20px;">
                If you didn't request a password reset, please ignore this email.<br>
                Your account remains secure.
              </p>
              
              <p style="color: #6c757d; font-size: 12px; margin-top: 30px; border-top: 1px solid #e9ecef; padding-top: 20px;">
                <strong>ThinkCivil IAS</strong> - Empowering Civil Service Aspirants
              </p>
            </div>
          </div>
        `,
        textContent: `
          ThinkCivil IAS - Password Reset

          Hello ${name},

          We received a request to reset your password. Use this OTP to proceed:

          Your verification code is: ${otp}

          This OTP is valid for 10 minutes.
          Do not share this code with anyone.

          If you didn't request a password reset, please ignore this email.
          Your account remains secure.

          ThinkCivil IAS - Empowering Civil Service Aspirants
        `
      });

      console.log(`Password reset OTP sent to ${email}: ${otp}`);
      return { success: true, messageId: response.messageId };
      
    } catch (error) {
      console.error('Error sending password reset OTP email:', error);
      throw new Error('Failed to send password reset OTP email');
    }
  }



  async sendPasswordResetSuccessEmail(email, name = 'User') {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL;
      const senderName = process.env.BREVO_SENDER_NAME;
      
      await this.emailApi.sendTransacEmail({
        sender: {
          email: senderEmail,
          name: senderName
        },
        to: [{ email, name }],
        subject: 'Password Reset Successful - ThinkCivil IAS',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #2c3e50; margin-bottom: 10px;">Password Reset Successful</h2>
              <p style="color: #10b981; font-size: 16px;">Your password has been successfully updated</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h3 style="color: #2c3e50; margin-bottom: 20px;">Hello ${name},</h3>
              
              <p style="color: #495057; line-height: 1.6; margin-bottom: 20px;">
                Your ThinkCivil IAS account password has been successfully reset.
              </p>
              
              <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h4 style="color: #065f46; margin-bottom: 10px;">✅ Security Alert:</h4>
                <ul style="color: #065f46; padding-left: 20px;">
                  <li>Your password was changed successfully</li>
                  <li>If you didn't make this change, please contact support immediately</li>
                  <li>For security, don't share your password with anyone</li>
                </ul>
              </div>
              
              <p style="color: #495057; line-height: 1.6; margin-bottom: 30px;">
                If you have any questions or need assistance, feel free to contact our support team.
              </p>
              
              <p style="color: #6c757d; font-size: 12px; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 20px;">
                Best regards,<br>
                <strong>ThinkCivil IAS Team</strong><br>
                Empowering Civil Service Aspirants
              </p>
            </div>
          </div>
        `,
        textContent: `
          Password Reset Successful - ThinkCivil IAS

          Hello ${name},

          Your ThinkCivil IAS account password has been successfully reset.

          ✅ Security Alert:
          • Your password was changed successfully
          • If you didn't make this change, please contact support immediately
          • For security, don't share your password with anyone

          If you have any questions or need assistance, feel free to contact our support team.

          Best regards,
          ThinkCivil IAS Team
          Empowering Civil Service Aspirants
        `
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Error sending password reset success email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(email, name) {
    try {
      const senderEmail = process.env.BREVO_SENDER_EMAIL;
      const senderName = process.env.BREVO_SENDER_NAME;
      
      await this.emailApi.sendTransacEmail({
        sender: {
          email: senderEmail,
          name: senderName
        },
        to: [{ email, name }],
        subject: 'Welcome to ThinkCivil IAS!',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #2c3e50; margin-bottom: 10px;">Welcome to ThinkCivil IAS!</h2>
              <p style="color: #4CAF50; font-size: 16px;">Your journey to civil services begins here</p>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
              <h3 style="color: #2c3e50; margin-bottom: 20px;">Hello ${name},</h3>
              
              <p style="color: #495057; line-height: 1.6; margin-bottom: 20px;">
                Thank you for registering with <strong>ThinkCivil IAS</strong>. Your account has been successfully created and verified.
              </p>
              
              <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4CAF50;">
                <h4 style="color: #2c3e50; margin-bottom: 10px;">🎯 Get Started:</h4>
                <ul style="color: #495057; padding-left: 20px;">
                  <li>Complete your profile</li>
                  <li>Explore our study materials</li>
                  <li>Take practice tests</li>
                  <li>Join live mentorship sessions</li>
                </ul>
              </div>
              
              <p style="color: #495057; line-height: 1.6; margin-bottom: 30px;">
                We're excited to support you in your civil services preparation journey. Our team of experts is here to guide you every step of the way.
              </p>
              
              <div style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'https://thinkcivilias.com'}/dashboard" 
                   style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Go to Dashboard
                </a>
              </div>
              
              <p style="color: #6c757d; font-size: 12px; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 20px;">
                Best regards,<br>
                <strong>ThinkCivil IAS Team</strong><br>
                Empowering Civil Service Aspirants.<br>
                Think better. Prepare smarter. Serve the nation.
              </p>
            </div>
          </div>
        `,
        textContent: `
          Welcome to ThinkCivil IAS!

          Hello ${name},

          Thank you for registering with ThinkCivil IAS. Your account has been successfully created and verified.

          🎯 Get Started:
          • Complete your profile
          • Explore our study materials
          • Take practice tests
          • Join live mentorship sessions

          We're excited to support you in your civil services preparation journey.

          Go to Dashboard: ${process.env.FRONTEND_URL}/dashboard

          Best regards,
          The ThinkCivil IAS Team
          Empowering Civil Service Aspirants.
          Think better. Prepare smarter. Serve the nation.
        `
      });
      
      return { success: true };
      
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Don't throw error for welcome email failure
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();