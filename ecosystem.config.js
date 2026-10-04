module.exports = {
  apps: [{
    name: 'thinkcivil-backend',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 5000,
      // MongoDB
      //MONGO_URL: 'mongodb+srv://thinkcivil05_db:Thinkcivil%402025@cluster0.d0wq5cc.mongodb.net/thinkcivil?appName=Cluster0',
      // Cloudflare R2 Configuration
     // MONGO_URL: 'mongodb+srv://thinkias:ThinkIAS26082026@thinkcluster.zsdrxik.mongodb.net/thinkcivil?retryWrites=true&w=majority',
      R2_ENDPOINT: 'https://2a5ee80cc1bc30032c071121f0ddf2be.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: '3725754b86b1eb6c205785148c24a539',
      R2_SECRET_ACCESS_KEY: '16357556460defcf57e4014871c544c812553fb81508bca67e2a137f75b77135', // Your actual secret key
      R2_BUCKET_NAME: 'thinkcivil',
      R2_PUBLIC_URL: 'https://pub-751c3537555b4882b111870f51d35262.r2.dev',
      // Brevo Email
      BREVO_API_KEY: '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',
      BREVO_SENDER_EMAIL: 'no-reply@thinkcivilias.com',
      BREVO_SENDER_NAME: 'Think Civil IAS',
      FRONTEND_URL: 'https://bytestech.online',
      // Razorpay
      RAZORPAY_KEY_ID: 'rzp_live_SIqYcoNWqixbI6',
      RAZORPAY_KEY_SECRET: 's0jobt1DdP7kirhbOBNAzL1e'
    }
  }]
};
