const cacheService = require('../services/cache.service');
const { logger } = require('../utils/logger');

/**
 * Cache middleware for weather data endpoints
 * Implements cache-aside pattern with write-through functionality
 */
class CacheMiddleware {
  /**
   * Weather data cache middleware
   * Checks cache first, serves from cache if available
   */
  static async weatherCache(req, res, next) {
    const city = req.params.city;
    const startTime = Date.now();
    
    if (!city) {
      return next();
    }

    try {
      // Try to get data from cache
      const cachedData = await cacheService.getWeatherData(city);
      
      if (cachedData) {
        const cacheAge = Date.now() - new Date(cachedData.cached_at).getTime();
        const cacheAgeMinutes = Math.floor(cacheAge / (1000 * 60));
        
        logger.info('Serving weather data from cache', {
          city,
          cacheAge: `${cacheAgeMinutes}m`,
          correlationId: req.correlationId,
          duration: Date.now() - startTime
        });

        // Add cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Age': cacheAgeMinutes.toString(),
          'X-Cache-Type': cachedData.is_popular ? 'popular' : 'standard'
        });

        return res.json({
          ...cachedData,
          cached: true,
          cache_age_minutes: cacheAgeMinutes
        });
      }

      // Cache miss - continue to actual API
      res.set('X-Cache', 'MISS');
      
      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Cache the response data (fire and forget)
        if (data && !data.error) {
          const isPopular = cacheService.isPopularCity(city);
          cacheService.setWeatherData(city, data, isPopular)
            .catch(error => {
              logger.error('Failed to cache weather data', { 
                city, 
                error: error.message 
              });
            });
        }
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error for weather', { 
        city, 
        error: error.message,
        correlationId: req.correlationId
      });
      
      res.set('X-Cache', 'ERROR');
      next();
    }
  }

  /**
   * Forecast data cache middleware
   * Checks cache first, serves from cache if available
   */
  static async forecastCache(req, res, next) {
    const city = req.params.city;
    const startTime = Date.now();
    
    if (!city) {
      return next();
    }

    try {
      // Try to get data from cache
      const cachedData = await cacheService.getForecastData(city);
      
      if (cachedData) {
        const cacheAge = Date.now() - new Date(cachedData.cached_at).getTime();
        const cacheAgeMinutes = Math.floor(cacheAge / (1000 * 60));
        
        logger.info('Serving forecast data from cache', {
          city,
          cacheAge: `${cacheAgeMinutes}m`,
          correlationId: req.correlationId,
          duration: Date.now() - startTime
        });

        // Add cache headers
        res.set({
          'X-Cache': 'HIT',
          'X-Cache-Age': cacheAgeMinutes.toString(),
          'X-Cache-Type': cachedData.is_popular ? 'popular' : 'standard'
        });

        return res.json({
          ...cachedData,
          cached: true,
          cache_age_minutes: cacheAgeMinutes
        });
      }

      // Cache miss - continue to actual API
      res.set('X-Cache', 'MISS');
      
      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Cache the response data (fire and forget)
        if (data && !data.error) {
          const isPopular = cacheService.isPopularCity(city);
          cacheService.setForecastData(city, data, isPopular)
            .catch(error => {
              logger.error('Failed to cache forecast data', { 
                city, 
                error: error.message 
              });
            });
        }
        
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error for forecast', { 
        city, 
        error: error.message,
        correlationId: req.correlationId
      });
      
      res.set('X-Cache', 'ERROR');
      next();
    }
  }

  /**
   * Cache invalidation middleware
   * Can be used for admin endpoints to manually invalidate cache
   */
  static async invalidateCache(req, res, next) {
    const { city, pattern } = req.body;
    
    try {
      let result;
      
      if (city) {
        result = await cacheService.invalidateCity(city);
        logger.info('Cache invalidated for city', { city, success: result });
      } else if (pattern) {
        result = await cacheService.invalidatePattern(pattern);
        logger.info('Cache pattern invalidated', { pattern, deletedCount: result });
      } else {
        return res.status(400).json({ 
          error: 'Either city or pattern must be provided' 
        });
      }

      res.json({ 
        success: true, 
        result,
        message: city ? `Cache invalidated for ${city}` : `${result} keys deleted for pattern ${pattern}`
      });
    } catch (error) {
      logger.error('Cache invalidation error', { 
        city, 
        pattern, 
        error: error.message 
      });
      
      res.status(500).json({ 
        error: 'Cache invalidation failed',
        details: error.message
      });
    }
  }

  /**
   * Cache warming middleware
   * Triggers cache warming for popular cities
   */
  static async warmCache(req, res, next) {
    try {
      const warmingResult = await cacheService.warmCache();
      
      logger.info('Cache warming initiated', {
        totalCities: warmingResult.analysis.length,
        citiesToWarm: warmingResult.citiesToWarm.length
      });

      res.json({
        success: true,
        message: 'Cache warming analysis completed',
        ...warmingResult
      });
    } catch (error) {
      logger.error('Cache warming error', { error: error.message });
      
      res.status(500).json({
        error: 'Cache warming failed',
        details: error.message
      });
    }
  }

  /**
   * Cache analytics middleware
   * Returns cache performance metrics
   */
  static async getCacheAnalytics(req, res, next) {
    try {
      const days = parseInt(req.query.days) || 7;
      const analytics = await cacheService.getCacheAnalytics(days);
      const redisStats = require('../services/redis.service').getStats();
      
      res.json({
        success: true,
        analytics,
        redis: redisStats,
        period: `${days} days`
      });
    } catch (error) {
      logger.error('Cache analytics error', { error: error.message });
      
      res.status(500).json({
        error: 'Failed to retrieve cache analytics',
        details: error.message
      });
    }
  }

  /**
   * Cache health check middleware
   */
  static async healthCheck(req, res, next) {
    try {
      const health = await cacheService.healthCheck();
      
      res.json({
        success: true,
        health,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Cache health check error', { error: error.message });
      
      res.status(500).json({
        error: 'Cache health check failed',
        details: error.message
      });
    }
  }

  /**
   * Cache info middleware for specific city
   */
  static async getCacheInfo(req, res, next) {
    const city = req.params.city || req.query.city;
    
    if (!city) {
      return res.status(400).json({
        error: 'City parameter is required'
      });
    }

    try {
      const cacheInfo = await cacheService.getCacheInfo(city);
      
      res.json({
        success: true,
        cacheInfo
      });
    } catch (error) {
      logger.error('Cache info error', { city, error: error.message });
      
      res.status(500).json({
        error: 'Failed to retrieve cache info',
        details: error.message
      });
    }
  }
}

module.exports = CacheMiddleware;
