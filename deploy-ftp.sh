#!/bin/bash

# FTP Deployment Script for AIPA Frontend
# Usage: ./deploy-ftp.sh <FTP_PASSWORD>

FTP_HOST="147.93.73.224"
FTP_USER="u805002786.propertywitchtest.com"
FTP_PORT="21"
FTP_PASS="$1"
LOCAL_DIR="/Users/tornikeminadze/Desktop/Getting-my-life-back/XX8/aipa/web/dist"
REMOTE_DIR="public_html"

if [ -z "$FTP_PASS" ]; then
    echo "Usage: ./deploy-ftp.sh <FTP_PASSWORD>"
    exit 1
fi

echo "🚀 Deploying to $FTP_HOST..."

lftp -u "$FTP_USER","$FTP_PASS" -p $FTP_PORT $FTP_HOST <<EOF
set ssl:verify-certificate no
set ftp:ssl-allow no
cd $REMOTE_DIR
mirror -R --verbose --delete $LOCAL_DIR .
bye
EOF

echo "✅ Frontend deployment complete!"
echo "🌐 Visit: http://propertywitchtest.com"
