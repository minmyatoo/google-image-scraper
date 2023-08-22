const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const axiosRetry = require('axios-retry');
const cliProgress = require('cli-progress');
const readline = require('readline'); // Import readline for user input

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36';

// Define emoji constants for logging
const EMOJI_CHECK = '✅';
const EMOJI_ERROR = '❌';
const EMOJI_INFO = 'ℹ️';

/**
 * Scrapes images from Google Images based on a query and saves them to a specified directory.
 *
 * @param {string} query - The search query for images.
 * @param {number} limit - The maximum number of images to download.
 * @param {string} outputDir - The directory where the images will be saved.
 * @param {number} delayBetweenRequests - The delay in milliseconds between HTTP requests.
 * @returns {Promise<string[]>} An array of file paths to the downloaded images.
 */
async function scrapeImages(query, limit, outputDir, delayBetweenRequests) {
    try {
        // Validate user input
        if (!query || isNaN(limit) || limit <= 0) {
            throw new Error('Invalid input parameters.');
        }

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, {recursive: true});
        }

        const maxResults = 1000; // Maximum number of results to retrieve

        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(limit, 0);

        const downloadedImages = [];

        for (let start = 0; start < maxResults; start += 100) {
            if (downloadedImages.length >= limit) {
                break;
            }

            const googleSearchURL = `https://www.google.com/search?q=${query}&tbm=isch&tbs=isz:lt&start=${start}`;

            const response = await axios.get(googleSearchURL, {
                headers: {
                    'User-Agent': USER_AGENT,
                },
            });

            const $ = cheerio.load(response.data);

            const imageUrls = [];
            $('img').each((index, element) => {
                const imageUrl = $(element).attr('src');
                if (imageUrl) {
                    imageUrls.push(imageUrl);
                }
            });

            for (let i = 0; i < imageUrls.length; i++) {
                if (downloadedImages.length >= limit) {
                    break;
                }

                const imageUrl = imageUrls[i];
                const imageFileName = path.join(outputDir, `${query.replace(/ /g, '-')}-${start + i + 1}.jpg`);

                try {
                    const imageResponse = await axios.get(imageUrl, {responseType: 'stream'});
                    imageResponse.data.pipe(fs.createWriteStream(imageFileName));
                    progressBar.update(downloadedImages.length + 1);
                    downloadedImages.push(imageFileName);
                } catch (downloadError) {
                    // Error on First call
                    //console.warn(`Fail downloading image ${start + i + 1}: ${downloadError.message}`);
                }

                // Pause for a delay between requests
                await delay(delayBetweenRequests);
            }
        }

        progressBar.stop();
        console.log(`${EMOJI_INFO} Scraped ${downloadedImages.length} images and saved them to ${outputDir}`);
        return downloadedImages;
    } catch (error) {
        console.error(`${EMOJI_ERROR} An error occurred: ${error.message}`);
        console.error(error.stack);
        return [];
    }
}

/**
 * Retrieves user input for search query and limit from the command line.
 *
 * @returns {Promise<{query: string, limit: number}>} An object containing user-provided query and limit.
 */
async function getUserInput() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    // Use readline to get user input for query and limit
    const query = await new Promise((resolve) => {
        rl.question('Enter a search query: ', resolve);
    });
    const limit = parseInt(await new Promise((resolve) => {
        rl.question('Enter the limit (number of images to download): ', resolve);
    }), 10);

    rl.close();

    return {query, limit};
}

/**
 * Delays the execution for the specified number of milliseconds.
 *
 * @param {number} ms - The delay duration in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main function for starting the image scraping process.
 */
async function startScraping() {
    try {
        console.log('--------------------------------------------');
        console.log('   📷 Google Image Scraper by Min Myat Oo 🌐');
        console.log('--------------------------------------------');

        const userInput = await getUserInput();
        const {query, limit} = userInput;

        const outputDir = './output'; // You can modify this if needed
        const delayBetweenRequests = 1000; // 1 second delay between requests

        console.log(`${EMOJI_INFO} Starting image scraping...`);
        const scrapedImages = await scrapeImages(query, limit, outputDir, delayBetweenRequests);

        if (scrapedImages.length === 0) {
            console.log(`${EMOJI_ERROR} No images were scraped.`);
        } else {
            console.log(`${EMOJI_CHECK} Image scraping completed successfully.`);
        }
    } catch (error) {
        console.error(`${EMOJI_ERROR} An error occurred: ${error.message}`);
        console.error(error.stack);
    }
}

// Call the startScraping function to begin the scraping process
startScraping();
