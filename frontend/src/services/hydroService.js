import api from './api';

export const hydroService = {
  getBarrages: async () => {
    const response = await api.get('/barrages');
    return response.data;
  },

  getPredictions: async (nomBarrage, tempDelta = 0, rainMultiplier = 1, horizon = 7) => {
    const response = await api.get('/predict', {
      params: { 
        barrage: nomBarrage,
        temp_delta: tempDelta,
        rain_multiplier: rainMultiplier,
        horizon: horizon
      }
    });
    return response.data;
  }
};