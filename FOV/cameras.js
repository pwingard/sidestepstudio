/* =============================================================================
 * cameras.js — camera/sensor database, generated from cameras.json.
 * Loaded as a plain <script> (NOT fetched) so the app stays offline-proof,
 * the same way data.js works. Exposes one global: CAMERA_DB.
 *
 *   CAMERA_DB.sensors[KEY] = { maker, width_mm, height_mm, diagonal_mm,
 *                              pixel_um, res_x, res_y, megapixels, format }
 *   CAMERA_DB.models = [ { brand, model, sensor } ]  // sensor joins into sensors
 *
 * To regenerate after editing cameras.json: re-emit from that JSON. No build.
 * ============================================================================= */

const CAMERA_DB = {
  "_meta": {
    "description": "Astro-camera sensor table + model->sensor alias map for FOV framing.",
    "note": "Join model.sensor to sensors[key]. Generic photographic formats (FULLFRAME_35MM, APS-C, APS-C_CANON, MICRO_FOURTHIRDS) carry null pixel/res by design.",
    "sensor_count": 44,
    "model_count": 140
  },
  "sensors": {
    "APS-C": {
      "maker": "generic",
      "width_mm": 23.6,
      "height_mm": 15.7,
      "diagonal_mm": 28.35,
      "pixel_um": null,
      "res_x": null,
      "res_y": null,
      "megapixels": null,
      "format": "APS-C reference"
    },
    "APS-C_CANON": {
      "maker": "generic",
      "width_mm": 22.3,
      "height_mm": 14.9,
      "diagonal_mm": 26.82,
      "pixel_um": null,
      "res_x": null,
      "res_y": null,
      "megapixels": null,
      "format": "APS-C (Canon 1.6x reference)"
    },
    "AR0130CS": {
      "maker": "ON Semi",
      "width_mm": 4.8,
      "height_mm": 3.6,
      "diagonal_mm": 6.0,
      "pixel_um": 3.75,
      "res_x": 1280,
      "res_y": 960,
      "megapixels": 1.2,
      "format": "1/3\" (guide cam)"
    },
    "FULLFRAME_35MM": {
      "maker": "generic",
      "width_mm": 36.0,
      "height_mm": 24.0,
      "diagonal_mm": 43.27,
      "pixel_um": null,
      "res_x": null,
      "res_y": null,
      "megapixels": null,
      "format": "Full-frame (35mm reference)"
    },
    "ICX694": {
      "maker": "Sony",
      "width_mm": 12.49,
      "height_mm": 9.99,
      "diagonal_mm": 15.99,
      "pixel_um": 4.54,
      "res_x": 2750,
      "res_y": 2200,
      "megapixels": 6.05,
      "format": "1\" EXview HAD CCD"
    },
    "ICX825": {
      "maker": "Sony",
      "width_mm": 8.98,
      "height_mm": 6.71,
      "diagonal_mm": 11.0,
      "pixel_um": 6.45,
      "res_x": 1392,
      "res_y": 1040,
      "megapixels": 1.45,
      "format": "2/3\" EXview HAD CCD II"
    },
    "IMX071": {
      "maker": "Sony",
      "width_mm": 23.6,
      "height_mm": 15.7,
      "diagonal_mm": 28.4,
      "pixel_um": 4.78,
      "res_x": 4944,
      "res_y": 3284,
      "megapixels": 16.2,
      "format": "APS-C (Bayer color)"
    },
    "IMX174": {
      "maker": "Sony",
      "width_mm": 11.25,
      "height_mm": 7.03,
      "diagonal_mm": 13.27,
      "pixel_um": 5.86,
      "res_x": 1920,
      "res_y": 1200,
      "megapixels": 2.3,
      "format": "1/1.2\""
    },
    "IMX178": {
      "maker": "Sony",
      "width_mm": 7.43,
      "height_mm": 4.99,
      "diagonal_mm": 8.95,
      "pixel_um": 2.4,
      "res_x": 3096,
      "res_y": 2080,
      "megapixels": 6.4,
      "format": "1/1.8\""
    },
    "IMX183": {
      "maker": "Sony",
      "width_mm": 13.2,
      "height_mm": 8.8,
      "diagonal_mm": 15.86,
      "pixel_um": 2.4,
      "res_x": 5496,
      "res_y": 3672,
      "megapixels": 20.18,
      "format": "1\""
    },
    "IMX193": {
      "maker": "Sony",
      "width_mm": 23.55,
      "height_mm": 15.73,
      "diagonal_mm": 28.32,
      "pixel_um": 3.91,
      "res_x": 6024,
      "res_y": 4024,
      "megapixels": 24.0,
      "format": "APS-C"
    },
    "IMX224": {
      "maker": "Sony",
      "width_mm": 4.89,
      "height_mm": 3.66,
      "diagonal_mm": 6.11,
      "pixel_um": 3.75,
      "res_x": 1304,
      "res_y": 976,
      "megapixels": 1.27,
      "format": "1/3\""
    },
    "IMX226": {
      "maker": "Sony",
      "width_mm": 7.53,
      "height_mm": 5.64,
      "diagonal_mm": 9.41,
      "pixel_um": 1.85,
      "res_x": 4072,
      "res_y": 3046,
      "megapixels": 12.4,
      "format": "1/1.7\""
    },
    "IMX249": {
      "maker": "Sony",
      "width_mm": 11.25,
      "height_mm": 7.03,
      "diagonal_mm": 13.27,
      "pixel_um": 5.86,
      "res_x": 1920,
      "res_y": 1200,
      "megapixels": 2.3,
      "format": "1/1.2\""
    },
    "IMX269": {
      "maker": "Sony",
      "width_mm": 17.42,
      "height_mm": 13.05,
      "diagonal_mm": 21.77,
      "pixel_um": 3.3,
      "res_x": 5280,
      "res_y": 3956,
      "megapixels": 20.89,
      "format": "4/3\""
    },
    "IMX290": {
      "maker": "Sony",
      "width_mm": 5.64,
      "height_mm": 3.18,
      "diagonal_mm": 6.47,
      "pixel_um": 2.9,
      "res_x": 1945,
      "res_y": 1097,
      "megapixels": 2.13,
      "format": "1/2.8\""
    },
    "IMX294": {
      "maker": "Sony",
      "width_mm": 19.1,
      "height_mm": 12.9,
      "diagonal_mm": 23.05,
      "pixel_um": 4.63,
      "res_x": 4144,
      "res_y": 2822,
      "megapixels": 11.69,
      "format": "4/3\""
    },
    "IMX304": {
      "maker": "Sony",
      "width_mm": 14.13,
      "height_mm": 10.3,
      "diagonal_mm": 17.49,
      "pixel_um": 3.45,
      "res_x": 4096,
      "res_y": 3000,
      "megapixels": 12.29,
      "format": "1.1\""
    },
    "IMX385": {
      "maker": "Sony",
      "width_mm": 5.62,
      "height_mm": 3.18,
      "diagonal_mm": 6.46,
      "pixel_um": 2.9,
      "res_x": 1936,
      "res_y": 1096,
      "megapixels": 2.12,
      "format": "1/2\""
    },
    "IMX410": {
      "maker": "Sony",
      "width_mm": 36.0,
      "height_mm": 24.0,
      "diagonal_mm": 43.27,
      "pixel_um": 5.94,
      "res_x": 6072,
      "res_y": 4042,
      "megapixels": 24.55,
      "format": "Full-frame (35mm)"
    },
    "IMX411": {
      "maker": "Sony",
      "width_mm": 53.36,
      "height_mm": 40.01,
      "diagonal_mm": 66.69,
      "pixel_um": 3.76,
      "res_x": 14192,
      "res_y": 10640,
      "megapixels": 151.0,
      "format": "Medium-format"
    },
    "IMX428": {
      "maker": "Sony",
      "width_mm": 14.18,
      "height_mm": 10.42,
      "diagonal_mm": 17.6,
      "pixel_um": 4.5,
      "res_x": 3208,
      "res_y": 2200,
      "megapixels": 7.06,
      "format": "1.1\""
    },
    "IMX429": {
      "maker": "Sony",
      "width_mm": 8.75,
      "height_mm": 6.62,
      "diagonal_mm": 11.0,
      "pixel_um": 4.5,
      "res_x": 1944,
      "res_y": 1472,
      "megapixels": 2.86,
      "format": "2/3\" global shutter (mono)"
    },
    "IMX432": {
      "maker": "Sony",
      "width_mm": 14.4,
      "height_mm": 10.8,
      "diagonal_mm": 18.0,
      "pixel_um": 9.0,
      "res_x": 1608,
      "res_y": 1104,
      "megapixels": 1.78,
      "format": "1.1\""
    },
    "IMX455": {
      "maker": "Sony",
      "width_mm": 35.98,
      "height_mm": 23.99,
      "diagonal_mm": 43.25,
      "pixel_um": 3.76,
      "res_x": 9568,
      "res_y": 6380,
      "megapixels": 61.04,
      "format": "Full-frame (35mm)"
    },
    "IMX461": {
      "maker": "Sony",
      "width_mm": 43.84,
      "height_mm": 32.88,
      "diagonal_mm": 54.8,
      "pixel_um": 3.76,
      "res_x": 11656,
      "res_y": 8742,
      "megapixels": 101.9,
      "format": "Medium-format (44x33)"
    },
    "IMX462": {
      "maker": "Sony",
      "width_mm": 5.57,
      "height_mm": 3.13,
      "diagonal_mm": 6.39,
      "pixel_um": 2.9,
      "res_x": 1920,
      "res_y": 1080,
      "megapixels": 2.07,
      "format": "1/2.8\""
    },
    "IMX464": {
      "maker": "Sony",
      "width_mm": 7.8,
      "height_mm": 4.41,
      "diagonal_mm": 8.96,
      "pixel_um": 2.9,
      "res_x": 2688,
      "res_y": 1520,
      "megapixels": 4.09,
      "format": "1/1.8\""
    },
    "IMX482": {
      "maker": "Sony",
      "width_mm": 11.14,
      "height_mm": 6.26,
      "diagonal_mm": 12.78,
      "pixel_um": 5.8,
      "res_x": 1920,
      "res_y": 1080,
      "megapixels": 2.07,
      "format": "1/1.2\""
    },
    "IMX485": {
      "maker": "Sony",
      "width_mm": 11.14,
      "height_mm": 6.26,
      "diagonal_mm": 12.78,
      "pixel_um": 2.9,
      "res_x": 3840,
      "res_y": 2160,
      "megapixels": 8.29,
      "format": "1/1.2\""
    },
    "IMX492": {
      "maker": "Sony",
      "width_mm": 19.3,
      "height_mm": 13.08,
      "diagonal_mm": 23.32,
      "pixel_um": 2.315,
      "res_x": 8336,
      "res_y": 5648,
      "megapixels": 47.08,
      "format": "4/3\""
    },
    "IMX533": {
      "maker": "Sony",
      "width_mm": 11.31,
      "height_mm": 11.31,
      "diagonal_mm": 16.0,
      "pixel_um": 3.76,
      "res_x": 3008,
      "res_y": 3008,
      "megapixels": 9.05,
      "format": "1\" (square)"
    },
    "IMX571": {
      "maker": "Sony",
      "width_mm": 23.5,
      "height_mm": 15.7,
      "diagonal_mm": 28.3,
      "pixel_um": 3.76,
      "res_x": 6248,
      "res_y": 4176,
      "megapixels": 26.1,
      "format": "APS-C"
    },
    "IMX585": {
      "maker": "Sony",
      "width_mm": 11.18,
      "height_mm": 6.32,
      "diagonal_mm": 12.84,
      "pixel_um": 2.9,
      "res_x": 3856,
      "res_y": 2180,
      "megapixels": 8.41,
      "format": "1/1.2\""
    },
    "IMX662": {
      "maker": "Sony",
      "width_mm": 5.6,
      "height_mm": 3.2,
      "diagonal_mm": 6.45,
      "pixel_um": 2.9,
      "res_x": 1920,
      "res_y": 1080,
      "megapixels": 2.07,
      "format": "1/2.8\" (planetary)"
    },
    "IMX664": {
      "maker": "Sony",
      "width_mm": 7.84,
      "height_mm": 4.48,
      "diagonal_mm": 9.02,
      "pixel_um": 2.9,
      "res_x": 2704,
      "res_y": 1540,
      "megapixels": 4.16,
      "format": "1/1.8\""
    },
    "IMX676": {
      "maker": "Sony",
      "width_mm": 7.1,
      "height_mm": 7.1,
      "diagonal_mm": 10.04,
      "pixel_um": 2.0,
      "res_x": 3552,
      "res_y": 3552,
      "megapixels": 12.62,
      "format": "1/1.6\" (square)"
    },
    "IMX678": {
      "maker": "Sony",
      "width_mm": 7.68,
      "height_mm": 4.32,
      "diagonal_mm": 8.81,
      "pixel_um": 2.0,
      "res_x": 3840,
      "res_y": 2160,
      "megapixels": 8.29,
      "format": "1/1.8\""
    },
    "IMX715": {
      "maker": "Sony",
      "width_mm": 5.6,
      "height_mm": 3.16,
      "diagonal_mm": 6.43,
      "pixel_um": 1.45,
      "res_x": 3864,
      "res_y": 2176,
      "megapixels": 8.41,
      "format": "1/2.8\""
    },
    "KAF-16200": {
      "maker": "Kodak/ON Semi",
      "width_mm": 27.0,
      "height_mm": 21.6,
      "diagonal_mm": 34.6,
      "pixel_um": 6.0,
      "res_x": 4500,
      "res_y": 3600,
      "megapixels": 16.2,
      "format": "CCD (4/3-class)"
    },
    "KAF-8300": {
      "maker": "Kodak/ON Semi",
      "width_mm": 17.96,
      "height_mm": 13.52,
      "diagonal_mm": 22.5,
      "pixel_um": 5.4,
      "res_x": 3326,
      "res_y": 2504,
      "megapixels": 8.3,
      "format": "CCD (4/3-class)"
    },
    "MICRO_FOURTHIRDS": {
      "maker": "generic",
      "width_mm": 17.3,
      "height_mm": 13.0,
      "diagonal_mm": 21.64,
      "pixel_um": null,
      "res_x": null,
      "res_y": null,
      "megapixels": null,
      "format": "Micro Four Thirds reference"
    },
    "MN34230": {
      "maker": "Panasonic",
      "width_mm": 17.7,
      "height_mm": 13.4,
      "diagonal_mm": 21.9,
      "pixel_um": 3.8,
      "res_x": 4656,
      "res_y": 3520,
      "megapixels": 16.0,
      "format": "4/3\""
    },
    "SC2210": {
      "maker": "SmartSens",
      "width_mm": 7.68,
      "height_mm": 4.32,
      "diagonal_mm": 8.81,
      "pixel_um": 4.0,
      "res_x": 1920,
      "res_y": 1080,
      "megapixels": 2.07,
      "format": "1/1.8\" (guide cam)"
    }
  },
  "models": [
    {
      "brand": "ZWO",
      "model": "ASI120MC-S",
      "sensor": "AR0130CS"
    },
    {
      "brand": "ZWO",
      "model": "ASI120MM-S",
      "sensor": "AR0130CS"
    },
    {
      "brand": "ZWO",
      "model": "ASI120MM Mini",
      "sensor": "AR0130CS"
    },
    {
      "brand": "ZWO",
      "model": "ASI174MC",
      "sensor": "IMX174"
    },
    {
      "brand": "ZWO",
      "model": "ASI174MM",
      "sensor": "IMX174"
    },
    {
      "brand": "ZWO",
      "model": "ASI174MM Mini",
      "sensor": "IMX174"
    },
    {
      "brand": "ZWO",
      "model": "ASI178MC",
      "sensor": "IMX178"
    },
    {
      "brand": "ZWO",
      "model": "ASI178MM",
      "sensor": "IMX178"
    },
    {
      "brand": "ZWO",
      "model": "ASI183MC Pro",
      "sensor": "IMX183"
    },
    {
      "brand": "ZWO",
      "model": "ASI183MM Pro",
      "sensor": "IMX183"
    },
    {
      "brand": "ZWO",
      "model": "ASI183MC",
      "sensor": "IMX183"
    },
    {
      "brand": "ZWO",
      "model": "ASI183MM",
      "sensor": "IMX183"
    },
    {
      "brand": "ZWO",
      "model": "ASI220MM Mini",
      "sensor": "SC2210"
    },
    {
      "brand": "ZWO",
      "model": "ASI224MC",
      "sensor": "IMX224"
    },
    {
      "brand": "ZWO",
      "model": "ASI290MC",
      "sensor": "IMX290"
    },
    {
      "brand": "ZWO",
      "model": "ASI290MM",
      "sensor": "IMX290"
    },
    {
      "brand": "ZWO",
      "model": "ASI290MM Mini",
      "sensor": "IMX290"
    },
    {
      "brand": "ZWO",
      "model": "ASI385MC",
      "sensor": "IMX385"
    },
    {
      "brand": "ZWO",
      "model": "ASI462MC",
      "sensor": "IMX462"
    },
    {
      "brand": "ZWO",
      "model": "ASI462MM",
      "sensor": "IMX462"
    },
    {
      "brand": "ZWO",
      "model": "ASI482MC",
      "sensor": "IMX482"
    },
    {
      "brand": "ZWO",
      "model": "ASI585MC",
      "sensor": "IMX585"
    },
    {
      "brand": "ZWO",
      "model": "ASI585MC Pro",
      "sensor": "IMX585"
    },
    {
      "brand": "ZWO",
      "model": "ASI585MM Pro",
      "sensor": "IMX585"
    },
    {
      "brand": "ZWO",
      "model": "ASI662MC",
      "sensor": "IMX662"
    },
    {
      "brand": "ZWO",
      "model": "ASI664MC",
      "sensor": "IMX664"
    },
    {
      "brand": "ZWO",
      "model": "ASI676MC",
      "sensor": "IMX676"
    },
    {
      "brand": "ZWO",
      "model": "ASI678MC",
      "sensor": "IMX678"
    },
    {
      "brand": "ZWO",
      "model": "ASI678MM",
      "sensor": "IMX678"
    },
    {
      "brand": "ZWO",
      "model": "ASI715MC",
      "sensor": "IMX715"
    },
    {
      "brand": "ZWO",
      "model": "ASI071MC Pro",
      "sensor": "IMX071"
    },
    {
      "brand": "ZWO",
      "model": "ASI294MC",
      "sensor": "IMX294"
    },
    {
      "brand": "ZWO",
      "model": "ASI294MC Pro",
      "sensor": "IMX294"
    },
    {
      "brand": "ZWO",
      "model": "ASI294MM",
      "sensor": "IMX492"
    },
    {
      "brand": "ZWO",
      "model": "ASI294MM Pro",
      "sensor": "IMX492"
    },
    {
      "brand": "ZWO",
      "model": "ASI432MM",
      "sensor": "IMX432"
    },
    {
      "brand": "ZWO",
      "model": "ASI533MC",
      "sensor": "IMX533"
    },
    {
      "brand": "ZWO",
      "model": "ASI533MC Pro",
      "sensor": "IMX533"
    },
    {
      "brand": "ZWO",
      "model": "ASI533MM",
      "sensor": "IMX533"
    },
    {
      "brand": "ZWO",
      "model": "ASI533MM Pro",
      "sensor": "IMX533"
    },
    {
      "brand": "ZWO",
      "model": "ASI1600MM Pro",
      "sensor": "MN34230"
    },
    {
      "brand": "ZWO",
      "model": "ASI1600MC Pro",
      "sensor": "MN34230"
    },
    {
      "brand": "ZWO",
      "model": "ASI2400MC Pro",
      "sensor": "IMX410"
    },
    {
      "brand": "ZWO",
      "model": "ASI2600MC Pro",
      "sensor": "IMX571"
    },
    {
      "brand": "ZWO",
      "model": "ASI2600MM Pro",
      "sensor": "IMX571"
    },
    {
      "brand": "ZWO",
      "model": "ASI2600MC Duo",
      "sensor": "IMX571"
    },
    {
      "brand": "ZWO",
      "model": "ASI2600MM Duo",
      "sensor": "IMX571"
    },
    {
      "brand": "ZWO",
      "model": "ASI2600MC Air",
      "sensor": "IMX571"
    },
    {
      "brand": "ZWO",
      "model": "ASI2600MM Air",
      "sensor": "IMX571"
    },
    {
      "brand": "ZWO",
      "model": "ASI461MM Pro",
      "sensor": "IMX461"
    },
    {
      "brand": "ZWO",
      "model": "ASI461MC Pro",
      "sensor": "IMX461"
    },
    {
      "brand": "ZWO",
      "model": "ASI6200MC Pro",
      "sensor": "IMX455"
    },
    {
      "brand": "ZWO",
      "model": "ASI6200MM Pro",
      "sensor": "IMX455"
    },
    {
      "brand": "QHY",
      "model": "QHY268C",
      "sensor": "IMX571"
    },
    {
      "brand": "QHY",
      "model": "QHY268M",
      "sensor": "IMX571"
    },
    {
      "brand": "QHY",
      "model": "QHY600C",
      "sensor": "IMX455"
    },
    {
      "brand": "QHY",
      "model": "QHY600M",
      "sensor": "IMX455"
    },
    {
      "brand": "QHY",
      "model": "QHY461C",
      "sensor": "IMX461"
    },
    {
      "brand": "QHY",
      "model": "QHY461M",
      "sensor": "IMX461"
    },
    {
      "brand": "QHY",
      "model": "QHY411C",
      "sensor": "IMX411"
    },
    {
      "brand": "QHY",
      "model": "QHY411M",
      "sensor": "IMX411"
    },
    {
      "brand": "QHY",
      "model": "QHY410C",
      "sensor": "IMX410"
    },
    {
      "brand": "QHY",
      "model": "QHY294C",
      "sensor": "IMX294"
    },
    {
      "brand": "QHY",
      "model": "QHY294M",
      "sensor": "IMX492"
    },
    {
      "brand": "QHY",
      "model": "QHY533C",
      "sensor": "IMX533"
    },
    {
      "brand": "QHY",
      "model": "QHY533M",
      "sensor": "IMX533"
    },
    {
      "brand": "QHY",
      "model": "QHY183C",
      "sensor": "IMX183"
    },
    {
      "brand": "QHY",
      "model": "QHY183M",
      "sensor": "IMX183"
    },
    {
      "brand": "QHY",
      "model": "QHY247C",
      "sensor": "IMX193"
    },
    {
      "brand": "QHY",
      "model": "QHY5III462C",
      "sensor": "IMX462"
    },
    {
      "brand": "QHY",
      "model": "QHY5III462M",
      "sensor": "IMX462"
    },
    {
      "brand": "QHY",
      "model": "QHY5III585C",
      "sensor": "IMX585"
    },
    {
      "brand": "QHY",
      "model": "QHY5III585M",
      "sensor": "IMX585"
    },
    {
      "brand": "QHY",
      "model": "QHY5III678C",
      "sensor": "IMX678"
    },
    {
      "brand": "QHY",
      "model": "QHY5III678M",
      "sensor": "IMX678"
    },
    {
      "brand": "QHY",
      "model": "QHY5III715C",
      "sensor": "IMX715"
    },
    {
      "brand": "QHY",
      "model": "QHY5III290C",
      "sensor": "IMX290"
    },
    {
      "brand": "QHY",
      "model": "QHY5III290M",
      "sensor": "IMX290"
    },
    {
      "brand": "QHY",
      "model": "QHY5III178C",
      "sensor": "IMX178"
    },
    {
      "brand": "QHY",
      "model": "QHY5III178M",
      "sensor": "IMX178"
    },
    {
      "brand": "QHY",
      "model": "QHY5III200M",
      "sensor": "IMX462"
    },
    {
      "brand": "Player One",
      "model": "Poseidon-C Pro",
      "sensor": "IMX571"
    },
    {
      "brand": "Player One",
      "model": "Poseidon-M Pro",
      "sensor": "IMX571"
    },
    {
      "brand": "Player One",
      "model": "Zeus-455C Pro",
      "sensor": "IMX455"
    },
    {
      "brand": "Player One",
      "model": "Zeus-455M Pro",
      "sensor": "IMX455"
    },
    {
      "brand": "Player One",
      "model": "Ares-C Pro",
      "sensor": "IMX533"
    },
    {
      "brand": "Player One",
      "model": "Ares-M Pro",
      "sensor": "IMX533"
    },
    {
      "brand": "Player One",
      "model": "Artemis-C Pro",
      "sensor": "IMX294"
    },
    {
      "brand": "Player One",
      "model": "Artemis-M Pro",
      "sensor": "IMX492"
    },
    {
      "brand": "Player One",
      "model": "Uranus-C Pro",
      "sensor": "IMX585"
    },
    {
      "brand": "Player One",
      "model": "Uranus-M Pro",
      "sensor": "IMX585"
    },
    {
      "brand": "Player One",
      "model": "Uranus-C",
      "sensor": "IMX585"
    },
    {
      "brand": "Player One",
      "model": "Uranus-M",
      "sensor": "IMX585"
    },
    {
      "brand": "Player One",
      "model": "Apollo-M MAX Pro",
      "sensor": "IMX432"
    },
    {
      "brand": "Player One",
      "model": "Apollo-M MAX",
      "sensor": "IMX432"
    },
    {
      "brand": "Player One",
      "model": "Apollo 428M MAX Pro",
      "sensor": "IMX428"
    },
    {
      "brand": "Player One",
      "model": "Apollo 428M MAX",
      "sensor": "IMX428"
    },
    {
      "brand": "Player One",
      "model": "Apollo-C",
      "sensor": "IMX174"
    },
    {
      "brand": "Player One",
      "model": "Apollo-M",
      "sensor": "IMX174"
    },
    {
      "brand": "Player One",
      "model": "Apollo-M MINI",
      "sensor": "IMX429"
    },
    {
      "brand": "Player One",
      "model": "Saturn-C SQR",
      "sensor": "IMX533"
    },
    {
      "brand": "Player One",
      "model": "Saturn-M SQR",
      "sensor": "IMX533"
    },
    {
      "brand": "Player One",
      "model": "Neptune-C II",
      "sensor": "IMX464"
    },
    {
      "brand": "Player One",
      "model": "Neptune 664C",
      "sensor": "IMX664"
    },
    {
      "brand": "Player One",
      "model": "Neptune-C",
      "sensor": "IMX178"
    },
    {
      "brand": "Player One",
      "model": "Neptune-M",
      "sensor": "IMX178"
    },
    {
      "brand": "Player One",
      "model": "Mars-C II",
      "sensor": "IMX662"
    },
    {
      "brand": "Player One",
      "model": "Mars-M II",
      "sensor": "IMX462"
    },
    {
      "brand": "Player One",
      "model": "Mars 662M",
      "sensor": "IMX662"
    },
    {
      "brand": "Player One",
      "model": "Mars-C",
      "sensor": "IMX462"
    },
    {
      "brand": "Player One",
      "model": "Mars-M",
      "sensor": "IMX290"
    },
    {
      "brand": "Player One",
      "model": "Xena 585M",
      "sensor": "IMX585"
    },
    {
      "brand": "Player One",
      "model": "Ceres 462M",
      "sensor": "IMX462"
    },
    {
      "brand": "Player One",
      "model": "Sedna-M",
      "sensor": "IMX178"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 26M",
      "sensor": "IMX571"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 26C",
      "sensor": "IMX571"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 183M",
      "sensor": "IMX183"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 183C",
      "sensor": "IMX183"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 269C",
      "sensor": "IMX269"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 294C",
      "sensor": "IMX294"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 115M (294M)",
      "sensor": "IMX492"
    },
    {
      "brand": "Altair Astro",
      "model": "Hypercam 174M",
      "sensor": "IMX174"
    },
    {
      "brand": "SVBony",
      "model": "SV405CC",
      "sensor": "IMX294"
    },
    {
      "brand": "SVBony",
      "model": "SV505C",
      "sensor": "IMX464"
    },
    {
      "brand": "SVBony",
      "model": "SV605CC",
      "sensor": "IMX533"
    },
    {
      "brand": "SVBony",
      "model": "SV605MC",
      "sensor": "IMX533"
    },
    {
      "brand": "SVBony",
      "model": "SV705C",
      "sensor": "IMX585"
    },
    {
      "brand": "ToupTek",
      "model": "ATR585C",
      "sensor": "IMX585"
    },
    {
      "brand": "ToupTek",
      "model": "ATR585M",
      "sensor": "IMX585"
    },
    {
      "brand": "ToupTek",
      "model": "ATR533C",
      "sensor": "IMX533"
    },
    {
      "brand": "ToupTek",
      "model": "ATR533M",
      "sensor": "IMX533"
    },
    {
      "brand": "ToupTek",
      "model": "ATR294M",
      "sensor": "IMX294"
    },
    {
      "brand": "Atik",
      "model": "Apx60",
      "sensor": "IMX455"
    },
    {
      "brand": "Atik",
      "model": "Apx26",
      "sensor": "IMX571"
    },
    {
      "brand": "Atik",
      "model": "Horizon II",
      "sensor": "MN34230"
    },
    {
      "brand": "Atik",
      "model": "Horizon",
      "sensor": "MN34230"
    },
    {
      "brand": "Atik",
      "model": "16200",
      "sensor": "KAF-16200"
    },
    {
      "brand": "Atik",
      "model": "460EX",
      "sensor": "ICX694"
    },
    {
      "brand": "Atik",
      "model": "414EX",
      "sensor": "ICX825"
    },
    {
      "brand": "Atik",
      "model": "383L+",
      "sensor": "KAF-8300"
    }
  ]
};
