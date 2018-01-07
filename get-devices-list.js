'use strict'

const mapKeys = require('lodash.mapkeys')

// ring has strange names for things, replace them with more intuitive names for device types:
const makeDevicesListFriendlier = input => {

  const keyReplacements = {
    doorbots: 'doorbells',
    authorized_doorbots: 'authorisedDoorbells',
    stickup_cams: 'cameras',
    base_stations: 'baseStations',
    chimes: 'chimes'
  }

  return mapKeys(input, (_, key) => keyReplacements[key] || key)
}

const emojis = {
  chime: '🛎',
  hp_cam_v1: '📷💡',
  hp_cam_v2: '📷💡',
  lpd_v1: '🚪',
  lpd_v2: '🚪'
}

function deviceToString () {
  return `[ ${emojis[this.kind] || this.kind} "${this.description}" ]`
}

module.exports = api => async () => {

  const getLiveStream = require('./get-live-stream')(api)
  const devices = makeDevicesListFriendlier(await api.restClient.authenticatedRequest('GET', api.apiUrls.devices()))

  const enhanceTypes = (typesList, enhancer) => {
    typesList.forEach(type => {
      devices[type].forEach(device =>
        enhancer(device, type))
    })
  }

  enhanceTypes(['cameras'], (device) => {
    const deviceUri = api.apiUrls.doorbots().device(device)
    device.lightOn = () => api.restClient.authenticatedRequest('PUT', deviceUri.lightOn())
    device.lightOff = () => api.restClient.authenticatedRequest('PUT', deviceUri.lightOff())
  })

  enhanceTypes(['cameras', 'doorbells'], (device) => {
    device.liveStream = () => getLiveStream(device)
  })

  enhanceTypes(['cameras', 'doorbells', 'chimes'], (device, type) => {
    // for getting health from the API, cams and doorbots are doorbots, but chimes
    // are chimes. ¯\_(ツ)_/¯
    const kludgedType = {
      'cameras': 'doorbots',
      'doorbells': 'doorbots',
      'chimes': 'chimes'
    }[type]

    const healthEndpoint = api.apiUrls[kludgedType]().device(device).health()

    device.health = async () => {
      const health = (await api.restClient.authenticatedRequest('GET', healthEndpoint)).device_health

      health.updated_at = new Date(health.updated_at)

      return health
    }
  })

  // convenience method to get an array of all devices
  devices.all = () => [].concat(devices.doorbells, devices.cameras, devices.chimes)

  devices.all().forEach(d => d.toString = deviceToString)

  return devices
}