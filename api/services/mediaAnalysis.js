const { s3, getFileKeyFromUrl } = require('../utils/cdn');
const Story = require('../models/stories');
const SingleStory = require('../models/singleStory');
const Videos = require('../models/videos');
const VideosCategory = require('../models/videosCategory');
const BrightBox = require('../models/brightBox');
const BrightBoxStory = require('../models/brightBoxStory');
const KidsSubmission = require('../models/kidsSubmission');

const { DO_SPACES_BUCKET, DO_SPACES_FOLDER } = process.env;

/**
 * List all files from DigitalOcean Spaces
 * @returns {Promise<Array>} Array of file objects with key, size, lastModified
 */
async function listAllSpaceFiles() {
	try {
		console.log('📂 Listing all files from DigitalOcean Spaces...');
		
		const allFiles = [];
		let continuationToken = null;
		const prefix = DO_SPACES_FOLDER ? DO_SPACES_FOLDER.replace(/^\/+|\/+$/g, '') : '';
		
		do {
			const params = {
				Bucket: DO_SPACES_BUCKET,
				MaxKeys: 1000
			};
			
			if (prefix) {
				params.Prefix = prefix;
			}
			
			if (continuationToken) {
				params.ContinuationToken = continuationToken;
			}
			
			const response = await s3.listObjectsV2(params).promise();
			
			if (response.Contents && response.Contents.length > 0) {
				allFiles.push(...response.Contents);
			}
			
			continuationToken = response.NextContinuationToken;
		} while (continuationToken);
		
		console.log(`✅ Found ${allFiles.length} files in DigitalOcean Spaces`);
		return allFiles;
	} catch (error) {
		console.error('❌ Error listing files from DO Space:', error);
		throw error;
	}
}

/**
 * Extract file URLs from a document and convert them to keys
 * @param {Object} doc - MongoDB document
 * @param {string} modelName - Name of the model for tracking
 * @returns {Array} Array of file keys
 */
function extractFileKeysFromDoc(doc, modelName = '') {
	const keys = new Set();
	
	if (!doc || typeof doc !== 'object') return [];
	
	// Recursively traverse the document
	function traverse(obj, path = '') {
		if (!obj || typeof obj !== 'object') return;
		
		// Handle arrays
		if (Array.isArray(obj)) {
			obj.forEach((item, index) => {
				traverse(item, `${path}[${index}]`);
			});
			return;
		}
		
		// Check all properties
		for (const [key, value] of Object.entries(obj)) {
			const currentPath = path ? `${path}.${key}` : key;
			
			if (value && typeof value === 'string') {
				// Check if it looks like a URL
				if (value.startsWith('http://') || value.startsWith('https://')) {
					const fileKey = getFileKeyFromUrl(value);
					if (fileKey) {
						keys.add(fileKey);
					}
				}
			} else if (value && typeof value === 'object') {
				traverse(value, currentPath);
			}
		}
	}
	
	traverse(doc);
	return Array.from(keys);
}

/**
 * Get all used file keys from all models in the database
 * @returns {Promise<Object>} Object with model names as keys and arrays of file keys as values
 */
async function getAllUsedFileKeys() {
	console.log('🔍 Extracting file references from all models...');
	
	const usedFiles = {
		Story: new Set(),
		SingleStory: new Set(),
		Videos: new Set(),
		VideosCategory: new Set(),
		BrightBox: new Set(),
		BrightBoxStory: new Set(),
		KidsSubmission: new Set()
	};
	
	try {
		// Stories (including nested episodes)
		const stories = await Story.find({}).lean();
		stories.forEach(story => {
			const keys = extractFileKeysFromDoc(story, 'Story');
			keys.forEach(key => usedFiles.Story.add(key));
		});
		console.log(`  ✓ Story: ${usedFiles.Story.size} unique files`);
		
		// Single Stories
		const singleStories = await SingleStory.find({}).lean();
		singleStories.forEach(story => {
			const keys = extractFileKeysFromDoc(story, 'SingleStory');
			keys.forEach(key => usedFiles.SingleStory.add(key));
		});
		console.log(`  ✓ SingleStory: ${usedFiles.SingleStory.size} unique files`);
		
		// Videos
		const videos = await Videos.find({}).lean();
		videos.forEach(video => {
			const keys = extractFileKeysFromDoc(video, 'Videos');
			keys.forEach(key => usedFiles.Videos.add(key));
		});
		console.log(`  ✓ Videos: ${usedFiles.Videos.size} unique files`);
		
		// Videos Categories
		const videoCategories = await VideosCategory.find({}).lean();
		videoCategories.forEach(cat => {
			const keys = extractFileKeysFromDoc(cat, 'VideosCategory');
			keys.forEach(key => usedFiles.VideosCategory.add(key));
		});
		console.log(`  ✓ VideosCategory: ${usedFiles.VideosCategory.size} unique files`);
		
		// BrightBox
		const brightBoxes = await BrightBox.find({}).lean();
		brightBoxes.forEach(box => {
			const keys = extractFileKeysFromDoc(box, 'BrightBox');
			keys.forEach(key => usedFiles.BrightBox.add(key));
		});
		console.log(`  ✓ BrightBox: ${usedFiles.BrightBox.size} unique files`);
		
		// BrightBoxStory
		const brightBoxStories = await BrightBoxStory.find({}).lean();
		brightBoxStories.forEach(story => {
			const keys = extractFileKeysFromDoc(story, 'BrightBoxStory');
			keys.forEach(key => usedFiles.BrightBoxStory.add(key));
		});
		console.log(`  ✓ BrightBoxStory: ${usedFiles.BrightBoxStory.size} unique files`);
		
		// KidsSubmission
		const kidsSubmissions = await KidsSubmission.find({}).lean();
		kidsSubmissions.forEach(sub => {
			const keys = extractFileKeysFromDoc(sub, 'KidsSubmission');
			keys.forEach(key => usedFiles.KidsSubmission.add(key));
		});
		console.log(`  ✓ KidsSubmission: ${usedFiles.KidsSubmission.size} unique files`);
		
		// Convert Sets to Arrays for response
		const result = {};
		let totalUnique = new Set();
		
		for (const [model, fileSet] of Object.entries(usedFiles)) {
			result[model] = Array.from(fileSet);
			result[model].forEach(key => totalUnique.add(key));
		}
		
		result._allUsed = Array.from(totalUnique);
		console.log(`✅ Total unique files used: ${result._allUsed.length}`);
		
		return result;
	} catch (error) {
		console.error('❌ Error extracting used file keys:', error);
		throw error;
	}
}

/**
 * Format file size in human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file extension from key
 * @param {string} key - File key
 * @returns {string} File extension (without dot)
 */
function getFileExtension(key) {
	if (!key) return 'unknown';
	const parts = key.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'unknown';
}

/**
 * Analyze media files in DigitalOcean Space
 * @returns {Promise<Object>} Comprehensive media analysis report
 */
async function analyzeMediaFiles() {
	try {
		console.log('\n📊 Starting media analysis...\n');
		
		// Get all files from DO Space
		const spaceFiles = await listAllSpaceFiles();
		
		// Get all used file keys from database
		const usedFilesData = await getAllUsedFileKeys();
		const allUsedKeys = new Set(usedFilesData._allUsed);
		
		// Categorize files
		const usedFiles = [];
		const unusedFiles = [];
		const totalSize = { used: 0, unused: 0, total: 0 };
		const fileTypeStats = {
			used: {},
			unused: {},
			total: {}
		};
		
		spaceFiles.forEach(file => {
			const key = file.Key;
			const size = file.Size || 0;
			const extension = getFileExtension(key);
			const isUsed = allUsedKeys.has(key);
			
			const fileInfo = {
				key,
				size,
				sizeFormatted: formatFileSize(size),
				extension,
				lastModified: file.LastModified,
				isUsed
			};
			
			totalSize.total += size;
			
			// Update file type statistics
			if (!fileTypeStats.total[extension]) {
				fileTypeStats.total[extension] = { count: 0, size: 0 };
			}
			fileTypeStats.total[extension].count++;
			fileTypeStats.total[extension].size += size;
			
			if (isUsed) {
				usedFiles.push(fileInfo);
				totalSize.used += size;
				
				if (!fileTypeStats.used[extension]) {
					fileTypeStats.used[extension] = { count: 0, size: 0 };
				}
				fileTypeStats.used[extension].count++;
				fileTypeStats.used[extension].size += size;
			} else {
				unusedFiles.push(fileInfo);
				totalSize.unused += size;
				
				if (!fileTypeStats.unused[extension]) {
					fileTypeStats.unused[extension] = { count: 0, size: 0 };
				}
				fileTypeStats.unused[extension].count++;
				fileTypeStats.unused[extension].size += size;
			}
		});
		
		// Format file type stats
		const formatTypeStats = (stats) => {
			const formatted = {};
			for (const [ext, data] of Object.entries(stats)) {
				formatted[ext] = {
					count: data.count,
					size: data.size,
					sizeFormatted: formatFileSize(data.size)
				};
			}
			return formatted;
		};
		
		const report = {
			summary: {
				totalFiles: spaceFiles.length,
				usedFiles: usedFiles.length,
				unusedFiles: unusedFiles.length,
				totalSize: {
					total: totalSize.total,
					totalFormatted: formatFileSize(totalSize.total),
					used: totalSize.used,
					usedFormatted: formatFileSize(totalSize.used),
					unused: totalSize.unused,
					unusedFormatted: formatFileSize(totalSize.unused),
					wastePercentage: totalSize.total > 0 
						? ((totalSize.unused / totalSize.total) * 100).toFixed(2) + '%'
						: '0%'
				}
			},
			byModel: {},
			fileTypeStats: {
				total: formatTypeStats(fileTypeStats.total),
				used: formatTypeStats(fileTypeStats.used),
				unused: formatTypeStats(fileTypeStats.unused)
			},
			unusedFiles: unusedFiles.sort((a, b) => b.size - a.size), // Sort by size descending
			usedFilesDetails: usedFiles,
			timestamp: new Date().toISOString()
		};
		
		// Add per-model statistics
		for (const [model, keys] of Object.entries(usedFilesData)) {
			if (model === '_allUsed') continue;
			
			const modelUsedFiles = spaceFiles.filter(f => keys.includes(f.Key));
			const modelSize = modelUsedFiles.reduce((sum, f) => sum + (f.Size || 0), 0);
			
			report.byModel[model] = {
				fileCount: keys.length,
				totalSize: modelSize,
				totalSizeFormatted: formatFileSize(modelSize)
			};
		}
		
		console.log('\n✅ Media analysis complete!\n');
		return report;
	} catch (error) {
		console.error('❌ Error in media analysis:', error);
		throw error;
	}
}

module.exports = {
	analyzeMediaFiles,
	listAllSpaceFiles,
	getAllUsedFileKeys
};




