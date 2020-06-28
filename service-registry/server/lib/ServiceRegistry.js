
// ServiceRegistry is an application level component
// when a new service comes to life, only has to know where to find the service registry
// services will register themselves here and queries can be made for specific service
// can be a single point of failure because if it goes down, the app has no way to discover services
// can have multiple instances of ServiceRegistry that maintain entries in a db
// the app can go through all possible instances until it finds one that is online

const semver = require('semver');
// module for parsing and comparing semver strings (semantic versioning)

// class for registry logic
class ServiceRegistry {
  constructor(log) {
    this.log = log;
    this.services = {};
    this.timeout = 30;
  }

  // Breakpoints
  // click Debug icon, cogwheel, in launch.json set program to app entrypoint,
  // click Run and debugger is attached, set breakpoint by clicking next to the line number, red

  // adds services
  register(name, version, ip, port) {
    this.cleanup();
    const key = name + version + ip + port;
    // a new service
    if (!this.services[key]) {
      this.services[key] = {};
      // unix timestamp in seconds
      this.services[key].timestamp = Math.floor(new Date() / 1000);
      this.services[key].ip = ip;
      this.services[key].port = port;
      this.services[key].name = name;
      this.services[key].version = version;
      this.log.debug(`Added services ${name}, version ${version} at ${ip}:${port}`);
      return key;
    }
    // service exists, so just update timestamp so that we know we have seen it again
    this.services[key].timestamp = Math.floor(new Date() / 1000);
    this.log.debug(`Updated services ${name}, version ${version} at ${ip}:${port}`);
    return key;
  }

  // get service matching the criteria
  get(name, version) {
    this.cleanup();
    const candidates = Object.values(this.services) // convert entries to array
      .filter(service => service.name === name && semver.satisfies(service.version, version));
    // randomly return a candidate
    // if no entry return falsy value. if one entry, return it. if more than one, select one
    // the computed index is a random whole number which is less than the length of the array
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  unregister(name, version, ip, port) {
    const key = name + version + ip + port;
    delete this.services[key]; // remove property from object
    this.log.debug(`Unregistered service ${name}, version ${version} at ${ip}:${port}`);
    return key;
  }

  // services should register and unregister themselves
  // but case may arise where they shut down non-gracefully without unregistering
  // so they should send a heartbeat to reregister themselves continuously
  // such that a service not seen in 30s is considered expired
  cleanup() {
    const now = Math.floor(new Date() / 1000); // current timestamp
    Object.keys(this.services).forEach((key) => {
      if (this.services[key].timestamp + this.timeout < now) {
        delete this.services[key];
        this.log.debug(`Removed service ${key}`);
      }
    });
  }
}

module.exports = ServiceRegistry;
