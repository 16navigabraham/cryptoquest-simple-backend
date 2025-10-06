import express from 'express';
import config from '../config/env.js';

const router = express.Router();

// Get level information for frontend
router.get('/levels', async (req, res) => {
  try {
    const levels = Object.keys(config.QUIZ_LEVELS).map(levelNum => {
      const level = config.QUIZ_LEVELS[levelNum];
      return {
        level: parseInt(levelNum),
        ...level
      };
    });

    res.json({
      success: true,
      data: {
        levels,
        totalLevels: levels.length
      }
    });
  } catch (error) {
    console.error('Error getting levels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve levels'
    });
  }
});

// Get specific level details
router.get('/levels/:level', async (req, res) => {
  try {
    const levelNum = parseInt(req.params.level);
    
    if (levelNum < 1 || levelNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Level must be between 1 and 5'
      });
    }

    const levelConfig = config.QUIZ_LEVELS[levelNum];
    
    res.json({
      success: true,
      data: {
        level: levelNum,
        ...levelConfig
      }
    });
  } catch (error) {
    console.error('Error getting level details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve level details'
    });
  }
});

export default router;