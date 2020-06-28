
const axios = require('axios');

// this is to prevent service outages from taking down the entire site/app
class CircuitBreaker {
  constructor() {
    this.states = {};
    this.failureThreshold = 5; // circuit goes open after a cetain no. of failures
    this.coolDownPeriod = 10; // before switching to cooldown period
    this.requestTimeout = 2; // time to wait for a http request to return
  }

  // created an entry in the states object for a given endpoint
  initState(endpoint) {
    this.states[endpoint] = {
      failures: 0,
      coolDownPeriod: this.coolDownPeriod,
      circuit: 'CLOSED',
      nextTry: 0,
    };
  }

  onSuccess(endpoint) {
    this.initState(endpoint); // reset state to deafult
  }

  onFailure(endpoint) {
    const state = this.states[endpoint];
    state.failures += 1; // increment failures counter
    if (state.failures > this.failureThreshold) {
      state.circuit = 'OPEN';
      state.nextTry = new Date() / 1000 + this.coolDownPeriod;
      console.log(`ALERT! Circuit for ${endpoint} is in state 'OPEN`);
    }
  }

  // tests which state app is in and whether can make a request
  canRequest(endpoint) {
    // ensure that entry for endpoint is initialized whenever this method is called
    if (!this.states[endpoint]) this.initState(endpoint);
    const state = this.states[endpoint];
    if (state.circuit === 'CLOSED') return true;
    const now = new Date() / 1000;
    if (state.nextTry <= now) {
      // request can be made up until failure threshold is exceeded and is set to OPEN
      state.circuit = 'HALF';
      return true;
    }
    return false;
  }

  async callService(requestOptions) {
    const endpoint = `${requestOptions.method}:${requestOptions.url}`;
    if (!this.canRequest(endpoint)) return false;
    // past here, circuit half-open or closed
    // eslint-disable-next-line no-param-reassign
    requestOptions.timeout = this.requestTimeout * 1000;
    try {
      const response = await axios(requestOptions);
      this.onSuccess(endpoint);
      return response.data;
    } catch (error) {
      this.onFailure(endpoint);
      return false;
    }
  }
}

module.exports = CircuitBreaker;
