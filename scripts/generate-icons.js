import { createCanvas } from 'canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_DIR = join(__dirname, '..', 'io.piercefamily.ip-display.sdPlugin', 'imgs', 'plugin');
const ACTIONS_DIR = join(__dirname, '..', 'io.piercefamily.ip-display.sdPlugin', 'imgs', 'actions');

// Ensure output directories exist
mkdirSync(PLUGIN_DIR, { recursive: true });
mkdirSync(ACTIONS_DIR, { recursive: true });

/**
 * Generate Category Icon (Network Topology Symbol)
 * Monochrome white on transparent background
 */
function generateCategoryIcon(size) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');

	// Scale factor for drawing
	const scale = size / 46; // Base design on 46px

	// Network topology: 3 connected nodes in triangle formation
	const centerX = size / 2;
	const centerY = size / 2;
	const radius = size * 0.35;
	const nodeRadius = size * 0.08;

	// Calculate positions for 3 nodes in triangle
	const node1 = { x: centerX, y: centerY - radius };
	const node2 = { x: centerX - radius * 0.866, y: centerY + radius * 0.5 };
	const node3 = { x: centerX + radius * 0.866, y: centerY + radius * 0.5 };

	// Draw connecting lines
	ctx.strokeStyle = '#FFFFFF';
	ctx.lineWidth = Math.max(2 * scale, 1.5);
	ctx.lineCap = 'round';

	ctx.beginPath();
	ctx.moveTo(node1.x, node1.y);
	ctx.lineTo(node2.x, node2.y);
	ctx.lineTo(node3.x, node3.y);
	ctx.lineTo(node1.x, node1.y);
	ctx.stroke();

	// Draw nodes
	ctx.fillStyle = '#FFFFFF';
	[node1, node2, node3].forEach(node => {
		ctx.beginPath();
		ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
		ctx.fill();
	});

	return canvas;
}

/**
 * Generate Marketplace Icon (Local + Public IP Symbol)
 * Colorful design showing house (local) and globe (public) connectivity
 */
function generateMarketplaceIcon(size) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');

	const scale = size / 512;
	const padding = size * 0.15;
	const centerX = size / 2;

	// Background gradient
	const bgGradient = ctx.createLinearGradient(0, 0, 0, size);
	bgGradient.addColorStop(0, '#1a1a2e');
	bgGradient.addColorStop(1, '#16213e');
	ctx.fillStyle = bgGradient;
	ctx.fillRect(0, 0, size, size);

	// Top section: Local Network (House symbol)
	const houseY = padding + size * 0.15;
	const houseSize = size * 0.15;

	// House roof
	ctx.fillStyle = '#4facfe';
	ctx.beginPath();
	ctx.moveTo(centerX, houseY - houseSize * 0.4);
	ctx.lineTo(centerX - houseSize, houseY + houseSize * 0.2);
	ctx.lineTo(centerX + houseSize, houseY + houseSize * 0.2);
	ctx.closePath();
	ctx.fill();

	// House body
	ctx.fillStyle = '#00c6ff';
	ctx.fillRect(centerX - houseSize * 0.7, houseY + houseSize * 0.2, houseSize * 1.4, houseSize * 1.2);

	// House door
	ctx.fillStyle = '#1a1a2e';
	ctx.fillRect(centerX - houseSize * 0.3, houseY + houseSize * 0.6, houseSize * 0.6, houseSize * 0.8);

	// Local connection dot
	ctx.fillStyle = '#00d4ff';
	ctx.shadowColor = '#00d4ff';
	ctx.shadowBlur = size * 0.02;
	ctx.beginPath();
	ctx.arc(centerX, houseY + houseSize * 1.8, size * 0.025, 0, Math.PI * 2);
	ctx.fill();
	ctx.shadowBlur = 0;

	// Middle: Connection line
	const lineStart = houseY + houseSize * 2;
	const lineEnd = size - padding - size * 0.25;

	const lineGradient = ctx.createLinearGradient(centerX, lineStart, centerX, lineEnd);
	lineGradient.addColorStop(0, '#00d4ff');
	lineGradient.addColorStop(1, '#00f260');

	ctx.strokeStyle = lineGradient;
	ctx.lineWidth = size * 0.008;
	ctx.setLineDash([size * 0.02, size * 0.01]);
	ctx.beginPath();
	ctx.moveTo(centerX, lineStart);
	ctx.lineTo(centerX, lineEnd);
	ctx.stroke();
	ctx.setLineDash([]);

	// Bottom section: Public Network (Globe symbol)
	const globeY = size - padding - size * 0.05;
	const globeRadius = size * 0.12;

	// Globe circle
	ctx.strokeStyle = '#00f260';
	ctx.lineWidth = size * 0.012;
	ctx.beginPath();
	ctx.arc(centerX, globeY, globeRadius, 0, Math.PI * 2);
	ctx.stroke();

	// Globe meridians
	ctx.strokeStyle = '#0ba360';
	ctx.lineWidth = size * 0.006;

	// Vertical meridian
	ctx.beginPath();
	ctx.ellipse(centerX, globeY, globeRadius * 0.4, globeRadius, 0, 0, Math.PI * 2);
	ctx.stroke();

	// Horizontal meridians
	[-0.5, 0, 0.5].forEach(offset => {
		ctx.beginPath();
		const y = globeY + globeRadius * offset;
		const width = Math.sqrt(1 - offset * offset) * globeRadius;
		ctx.ellipse(centerX, y, width, globeRadius * 0.25, 0, 0, Math.PI * 2);
		ctx.stroke();
	});

	// Public connection dot
	ctx.fillStyle = '#00f260';
	ctx.shadowColor = '#00f260';
	ctx.shadowBlur = size * 0.02;
	ctx.beginPath();
	ctx.arc(centerX, globeY - globeRadius * 1.5, size * 0.025, 0, Math.PI * 2);
	ctx.fill();
	ctx.shadowBlur = 0;

	return canvas;
}

/**
 * Generate Dual IP Action Icon
 * Symbol: Two stacked connection dots representing local + public
 */
function generateDualIPActionIcon(size) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');

	const scale = size / 40;
	const centerX = size / 2;
	const centerY = size / 2;
	const dotRadius = size * 0.12;
	const spacing = size * 0.35;

	ctx.fillStyle = '#FFFFFF';
	ctx.strokeStyle = '#FFFFFF';
	ctx.lineWidth = Math.max(2 * scale, 1.5);

	// Top dot (local)
	ctx.beginPath();
	ctx.arc(centerX, centerY - spacing, dotRadius, 0, Math.PI * 2);
	ctx.fill();

	// Bottom dot (public)
	ctx.beginPath();
	ctx.arc(centerX, centerY + spacing, dotRadius, 0, Math.PI * 2);
	ctx.fill();

	// Connecting line
	ctx.beginPath();
	ctx.moveTo(centerX, centerY - spacing + dotRadius);
	ctx.lineTo(centerX, centerY + spacing - dotRadius);
	ctx.stroke();

	return canvas;
}

/**
 * Generate Local IP Action Icon
 * Symbol: House representing local network
 */
function generateLocalIPActionIcon(size) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');

	const scale = size / 40;
	const centerX = size / 2;
	const centerY = size / 2;
	const houseSize = size * 0.45;

	ctx.fillStyle = '#FFFFFF';
	ctx.strokeStyle = '#FFFFFF';
	ctx.lineWidth = Math.max(2 * scale, 1.5);
	ctx.lineJoin = 'round';

	// House roof
	ctx.beginPath();
	ctx.moveTo(centerX, centerY - houseSize * 0.4);
	ctx.lineTo(centerX - houseSize * 0.6, centerY + houseSize * 0.1);
	ctx.lineTo(centerX + houseSize * 0.6, centerY + houseSize * 0.1);
	ctx.closePath();
	ctx.fill();

	// House body
	ctx.fillRect(
		centerX - houseSize * 0.45,
		centerY + houseSize * 0.1,
		houseSize * 0.9,
		houseSize * 0.5
	);

	return canvas;
}

/**
 * Generate Public IP Action Icon
 * Symbol: Globe representing public internet
 */
function generatePublicIPActionIcon(size) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');

	const scale = size / 40;
	const centerX = size / 2;
	const centerY = size / 2;
	const radius = size * 0.4;

	ctx.strokeStyle = '#FFFFFF';
	ctx.lineWidth = Math.max(2 * scale, 1.5);
	ctx.lineCap = 'round';

	// Globe circle
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
	ctx.stroke();

	// Vertical meridian
	ctx.beginPath();
	ctx.ellipse(centerX, centerY, radius * 0.35, radius, 0, 0, Math.PI * 2);
	ctx.stroke();

	// Horizontal equator
	ctx.beginPath();
	ctx.ellipse(centerX, centerY, radius, radius * 0.25, 0, 0, Math.PI * 2);
	ctx.stroke();

	return canvas;
}

/**
 * Generate Toggle IP Action Icon
 * Symbol: Circular arrows representing cycle/toggle
 */
function generateToggleIPActionIcon(size) {
	const canvas = createCanvas(size, size);
	const ctx = canvas.getContext('2d');

	const scale = size / 40;
	const centerX = size / 2;
	const centerY = size / 2;
	const radius = size * 0.35;
	const arrowSize = size * 0.15;

	ctx.strokeStyle = '#FFFFFF';
	ctx.lineWidth = Math.max(2 * scale, 1.5);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	// Top arc with arrow
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, -Math.PI * 0.6, Math.PI * 0.4, false);
	ctx.stroke();

	// Top arrow head
	const topArrowX = centerX + radius * Math.cos(Math.PI * 0.4);
	const topArrowY = centerY + radius * Math.sin(Math.PI * 0.4);
	ctx.beginPath();
	ctx.moveTo(topArrowX, topArrowY);
	ctx.lineTo(topArrowX + arrowSize * 0.5, topArrowY - arrowSize);
	ctx.moveTo(topArrowX, topArrowY);
	ctx.lineTo(topArrowX + arrowSize, topArrowY + arrowSize * 0.3);
	ctx.stroke();

	// Bottom arc with arrow
	ctx.beginPath();
	ctx.arc(centerX, centerY, radius, Math.PI * 0.4, -Math.PI * 0.6, false);
	ctx.stroke();

	// Bottom arrow head
	const botArrowX = centerX + radius * Math.cos(-Math.PI * 0.6);
	const botArrowY = centerY + radius * Math.sin(-Math.PI * 0.6);
	ctx.beginPath();
	ctx.moveTo(botArrowX, botArrowY);
	ctx.lineTo(botArrowX - arrowSize * 0.5, botArrowY + arrowSize);
	ctx.moveTo(botArrowX, botArrowY);
	ctx.lineTo(botArrowX - arrowSize, botArrowY - arrowSize * 0.3);
	ctx.stroke();

	return canvas;
}

/**
 * Resize canvas to create standard resolution version
 */
function resizeCanvas(sourceCanvas, targetWidth, targetHeight) {
	const canvas = createCanvas(targetWidth, targetHeight);
	const ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
	return canvas;
}

/**
 * Save canvas to PNG file
 */
function saveCanvas(canvas, directory, filename) {
	const buffer = canvas.toBuffer('image/png');
	const filepath = join(directory, filename);
	writeFileSync(filepath, buffer);
	console.log(`✓ Generated: ${filename}`);
}

// Generate all icons
console.log('Generating IP Display plugin icons...\n');

// Category Icons
console.log('Plugin Icons:');
const categoryIcon2x = generateCategoryIcon(46);
const categoryIcon1x = resizeCanvas(categoryIcon2x, 28, 28);
saveCanvas(categoryIcon1x, PLUGIN_DIR, 'category-icon.png');
saveCanvas(categoryIcon2x, PLUGIN_DIR, 'category-icon@2x.png');

// Marketplace Icons
const marketplaceIcon2x = generateMarketplaceIcon(512);
const marketplaceIcon1x = resizeCanvas(marketplaceIcon2x, 256, 256);
saveCanvas(marketplaceIcon1x, PLUGIN_DIR, 'marketplace.png');
saveCanvas(marketplaceIcon2x, PLUGIN_DIR, 'marketplace@2x.png');

// Action Icons
console.log('\nAction Icons:');

// Dual IP Display
const dualIPDir = join(ACTIONS_DIR, 'dual-ip');
mkdirSync(dualIPDir, { recursive: true });
const dualIPIcon2x = generateDualIPActionIcon(40);
const dualIPIcon1x = resizeCanvas(dualIPIcon2x, 20, 20);
saveCanvas(dualIPIcon1x, dualIPDir, 'icon.png');
saveCanvas(dualIPIcon2x, dualIPDir, 'icon@2x.png');

// Local IP Display
const localIPDir = join(ACTIONS_DIR, 'local-ip-only');
mkdirSync(localIPDir, { recursive: true });
const localIPIcon2x = generateLocalIPActionIcon(40);
const localIPIcon1x = resizeCanvas(localIPIcon2x, 20, 20);
saveCanvas(localIPIcon1x, localIPDir, 'icon.png');
saveCanvas(localIPIcon2x, localIPDir, 'icon@2x.png');

// Public IP Display
const publicIPDir = join(ACTIONS_DIR, 'public-ip-only');
mkdirSync(publicIPDir, { recursive: true });
const publicIPIcon2x = generatePublicIPActionIcon(40);
const publicIPIcon1x = resizeCanvas(publicIPIcon2x, 20, 20);
saveCanvas(publicIPIcon1x, publicIPDir, 'icon.png');
saveCanvas(publicIPIcon2x, publicIPDir, 'icon@2x.png');

// Toggle IP Display
const toggleIPDir = join(ACTIONS_DIR, 'toggle-ip');
mkdirSync(toggleIPDir, { recursive: true });
const toggleIPIcon2x = generateToggleIPActionIcon(40);
const toggleIPIcon1x = resizeCanvas(toggleIPIcon2x, 20, 20);
saveCanvas(toggleIPIcon1x, toggleIPDir, 'icon.png');
saveCanvas(toggleIPIcon2x, toggleIPDir, 'icon@2x.png');

console.log('\n✓ All icons generated successfully!');
