/* eslint-disable class-methods-use-this */
const axios = require('axios');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const util = require('util');
const CircuitBreaker = require('../lib/CircuitBreaker');

const circuitBreaker = new CircuitBreaker();
// asynchronously tests whether the given path exists by checking with the file system
const fsexists = util.promisify(fs.exists);

class SpeakersService {
  constructor({ serviceRegistryUrl, serviceVersionIdentifier }) {
    this.serviceRegistryUrl = serviceRegistryUrl;
    this.serviceVersionIdentifier = serviceVersionIdentifier;
    this.cache = {};
  }

  async getImage(path) {
    const { ip, port } = await this.getService('speakers-service');
    return this.callService({
      method: 'get',
      responseType: 'stream',
      url: `http://${ip}:${port}/images/${path}`,
    });
  }

  async getNames() {
    const { ip, port } = await this.getService('speakers-service');
    return this.callService({
      method: 'get',
      url: `http://${ip}:${port}/names`,
    });
  }

  async getListShort() {
    const { ip, port } = await this.getService('speakers-service');
    return this.callService({
      method: 'get',
      url: `http://${ip}:${port}/list-short`,
    });
  }

  async getList() {
    const { ip, port } = await this.getService('speakers-service');
    return this.callService({
      method: 'get',
      url: `http://${ip}:${port}/list`,
    });
  }

  async getAllArtwork() {
    const { ip, port } = await this.getService('speakers-service');
    return this.callService({
      method: 'get',
      url: `http://${ip}:${port}/artwork`,
    });
  }

  async getSpeaker(shortname) {
    const { ip, port } = await this.getService('speakers-service');
    return this.callService({
      method: 'get',
      url: `http://${ip}:${port}/speaker/${shortname}`,
    });
  }

  async getArtworkForSpeaker(shortname) {
    const { ip, port } = await this.getService('speakers-service');
    return this.callService({
      method: 'get',
      url: `http://${ip}:${port}/artwork/${shortname}`,
    });
  }

  async callService(requestOptions) {
    // get path without ip and port
    const servicePath = url.parse(requestOptions.url).path;
    // get key that uniquely identifies the endpoint
    const cacheKey = crypto.createHash('md5').update(requestOptions.method + servicePath).digest('hex');
    // add support for image caching as they will not be cached as they have responsetype of stream
    let cacheFile = null;
    if (requestOptions.responseType && requestOptions.responseType === 'stream') {
      cacheFile = `${__dirname}/../../_imagecache/${cacheKey}`;
    }

    const result = await circuitBreaker.callService(requestOptions);
    if (!result) { // circuit is open (i.e. service down), so use cache
      if (this.cache[cacheKey]) return this.cache[cacheKey]; // regular request, return cached data

      if (cacheFile) { // this is a request for image, return cached image
        const exists = await fsexists(cacheFile);
        if (exists) return fs.createReadStream(cacheFile);
      }
      return false;
    }

    // circuit is closed or half-open, so cache most recent result
    if (!cacheFile) { // this is a regular request
      this.cache[cacheKey] = result; // cache the result for use when the circuit goes open
    } else {
      const ws = fs.createWriteStream(cacheFile);
      result.pipe(ws); // pipe and write the image result returned from callService to the cachefile
    }
    return result;
  }

  async getService(servicename) {
    const response = await axios.get(`${this.serviceRegistryUrl}/find/${servicename}/${this.serviceVersionIdentifier}`);
    return response.data;
  }
}

module.exports = SpeakersService;
