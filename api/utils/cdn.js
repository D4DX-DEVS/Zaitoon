const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

const {
	DO_SPACES_KEY,
	DO_SPACES_SECRET,
	DO_SPACES_ENDPOINT,
	DO_SPACES_BUCKET,
	DO_SPACES_CDN_ENDPOINT,
	DO_SPACES_FOLDER
} = process.env;

if (!DO_SPACES_KEY || !DO_SPACES_SECRET || !DO_SPACES_ENDPOINT || !DO_SPACES_BUCKET) {
	throw new Error('Missing required DigitalOcean Spaces environment variables');
}

const endpoint = new AWS.Endpoint(DO_SPACES_ENDPOINT.replace(/\/$/, ''));

const s3 = new AWS.S3({
	endpoint,
	accessKeyId: DO_SPACES_KEY,
	secretAccessKey: DO_SPACES_SECRET,
	signatureVersion: 'v4'
});

function generateObjectKey(originalName) {
	const safePrefix = (DO_SPACES_FOLDER || '').replace(/^\/+|\/+$/g, '');
	const ext = path.extname(originalName || '').toLowerCase();
	const timestamp = Date.now();
	const randomPart = Math.random().toString(36).slice(2, 8);
	return [safePrefix, `${timestamp}-${randomPart}${ext}`].filter(Boolean).join('/');
}

const storage = multerS3({
	s3,
	bucket: DO_SPACES_BUCKET,
	acl: 'public-read',
	contentType: multerS3.AUTO_CONTENT_TYPE,
	key: function (req, file, cb) {
		try {
			const key = generateObjectKey(file.originalname);
			cb(null, key);
		} catch (err) {
			cb(err);
		}
	}
});

const upload = multer({
	storage
	// No file size limits - unlimited file uploads
});

function buildCdnUrl(key) {
	const cdnBase = (DO_SPACES_CDN_ENDPOINT || '').replace(/\/$/, '');
	if (!cdnBase) return null;
	return `${cdnBase}/${key}`;
}

function getFileKeyFromUrl(url) {
	try {
		if (!url) return null;
		const cdnBase = (DO_SPACES_CDN_ENDPOINT || '').replace(/\/$/, '');
		const originBase = (DO_SPACES_ENDPOINT || '').replace(/\/$/, '');

		if (cdnBase && url.startsWith(cdnBase + '/')) {
			return url.substring(cdnBase.length + 1);
		}

		// Handle origin style URLs: https://region.digitaloceanspaces.com/bucket/key
		const originBucketBase = originBase ? `${originBase}/${DO_SPACES_BUCKET}` : '';
		if (originBucketBase && url.startsWith(originBucketBase + '/')) {
			return url.substring(originBucketBase.length + 1);
		}

		// Handle virtual-hosted style if ever used: https://bucket.region.digitaloceanspaces.com/key
		const parsed = new URL(url);
		const pathname = parsed.pathname.replace(/^\//, '');
		return pathname || null;
	} catch (_) {
		return null;
	}
}

async function deleteFile(key) {
	if (!key) return;
	await s3.deleteObject({ Bucket: DO_SPACES_BUCKET, Key: key }).promise();
}

async function uploadBuffer(buffer, filename, contentType = 'application/octet-stream') {
	try {
		const key = generateObjectKey(filename);
		await s3.putObject({
			Bucket: DO_SPACES_BUCKET,
			Key: key,
			Body: buffer,
			ACL: 'public-read',
			ContentType: contentType
		}).promise();

		const cdnUrl = buildCdnUrl(key);
		return { key, url: cdnUrl || `https://${DO_SPACES_ENDPOINT}/${DO_SPACES_BUCKET}/${key}` };
	} catch (error) {
		console.error('Upload buffer error:', error);
		throw error;
	}
}

module.exports = {
	upload,
	deleteFile,
	getFileKeyFromUrl,
	buildCdnUrl,
	uploadBuffer,
	s3  // Export for direct access if needed
};


