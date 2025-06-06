// server/src/utils/cloudinaryHelper.js

/**
 * CloudinaryHelper - Manages Cloudinary URLs for mood SVG assets
 * Exactly matches the Flutter CloudinaryHelper implementation
 */
class CloudinaryHelper {
  // Your Cloudinary cloud name
  static CLOUD_NAME = 'dm7qxemrt';
  
  // Base URL for Cloudinary assets
  static BASE_URL = `https://res.cloudinary.com/${CloudinaryHelper.CLOUD_NAME}/image/upload`;
  
  // EXACT working mood URLs from Cloudinary (matching Flutter implementation)
  static MOOD_URLS = {
    great: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_Great_anfp2e.svg',
    good: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_good_ldcpo4.svg',
    okay: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_okay_tcf9cp.svg',
    struggling: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_struggling_regocn.svg',
    upset: 'https://res.cloudinary.com/dm7qxemrt/image/upload/v1749199687/Face_Im_upset_pqskxp.svg'
  };

  /**
   * Get mood URL by key (exact match to Flutter implementation)
   * @param {string} moodKey - The mood key (great, good, okay, struggling, upset)
   * @returns {string} Complete Cloudinary URL for the mood SVG
   */
  static getMoodUrl(moodKey) {
    return CloudinaryHelper.MOOD_URLS[moodKey] || CloudinaryHelper.MOOD_URLS['okay']; // Default to 'okay' if not found
  }

  /**
   * Get mood SVG URL by mood key (alternative method - matches Flutter)
   * @param {string} moodKey - The mood key
   * @returns {string} Complete Cloudinary URL for the mood SVG
   */
  static getMoodSvgUrl(moodKey) {
    return CloudinaryHelper.getMoodUrl(moodKey);
  }

  /**
   * Get all mood URLs as an object (matches Flutter moodUrls map)
   * @returns {Object} Object with mood keys and their corresponding URLs
   */
  static getAllMoodUrls() {
    return { ...CloudinaryHelper.MOOD_URLS };
  }

  /**
   * Validate if a URL is a valid Cloudinary mood SVG URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid Cloudinary mood SVG URL
   */
  static isValidMoodUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return Object.values(CloudinaryHelper.MOOD_URLS).includes(url);
  }

  /**
   * Get mood key from Cloudinary URL
   * @param {string} url - Cloudinary URL
   * @returns {string|null} Mood key if found, null otherwise
   */
  static getMoodKeyFromUrl(url) {
    for (const [moodKey, moodUrl] of Object.entries(CloudinaryHelper.MOOD_URLS)) {
      if (moodUrl === url) {
        return moodKey;
      }
    }
    return null;
  }

  /**
   * Get mood data object with all related information
   * @param {string} moodKey - The mood key
   * @returns {Object} Mood data object with key, URL, rating, and label
   */
  static getMoodData(moodKey) {
    const moodLabels = {
      great: "I'm great",
      good: "I'm good", 
      okay: "I'm okay",
      struggling: "I'm struggling",
      upset: "I'm upset"
    };

    const moodRatings = {
      great: 5,
      good: 4,
      okay: 3,
      struggling: 2,
      upset: 1
    };

    if (!CloudinaryHelper.MOOD_URLS[moodKey]) {
      console.warn(`Unknown mood key: ${moodKey}, defaulting to 'okay'`);
      moodKey = 'okay';
    }

    return {
      key: moodKey,
      url: CloudinaryHelper.getMoodUrl(moodKey),
      rating: moodRatings[moodKey],
      label: moodLabels[moodKey]
    };
  }

  /**
   * Get all mood data as an array
   * @returns {Array} Array of mood data objects
   */
  static getAllMoodData() {
    return Object.keys(CloudinaryHelper.MOOD_URLS).map(moodKey => 
      CloudinaryHelper.getMoodData(moodKey)
    );
  }

  /**
   * Convert mood rating (1-5) to mood key
   * @param {number} rating - Mood rating (1-5)
   * @returns {string} Corresponding mood key
   */
  static getRatingToMoodKey(rating) {
    const ratingMap = {
      5: 'great',
      4: 'good',
      3: 'okay',
      2: 'struggling',
      1: 'upset'
    };

    return ratingMap[rating] || 'okay';
  }

  /**
   * Convert mood key to rating (1-5)
   * @param {string} moodKey - Mood key
   * @returns {number} Corresponding mood rating
   */
  static getMoodKeyToRating(moodKey) {
    const keyMap = {
      great: 5,
      good: 4,
      okay: 3,
      struggling: 2,
      upset: 1
    };

    return keyMap[moodKey] || 3;
  }
}

module.exports = {
  CloudinaryHelper
};