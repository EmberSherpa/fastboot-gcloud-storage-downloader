"use strict";

const fs = require("fs");
const path = require("path");
const fsp = require("fs-promise");
const { exec } = require("child_process");
const { Storage } = require("@google-cloud/storage");

const storage = new Storage();

function AppNotFoundError(message) {
  const error = new Error(message);
  error.name = "AppNotFoundError";

  return error;
}

/*
 * Downloader class that downloads the latest version of the deployed
 * app from GCloud Storage and unzips it.
 */
class GCloudStorageDownloader {
  constructor(options) {
    this.ui = options.ui;
    this.configBucket = options.bucket;
    this.configKey = options.key;
  }

  download() {
    if (!this.configBucket || !this.configKey) {
      this.ui.writeError(
        "no gcloud Storage bucket or key; not downloading app"
      );
      return Promise.reject(new AppNotFoundError());
    }

    return this.fetchCurrentVersion()
      .then(() => this.removeOldApp())
      .then(() => this.downloadAppZip())
      .then(() => this.unzipApp())
      .then(() => this.installNPMDependencies())
      .then(() => this.outputPath);
  }

  removeOldApp() {
    this.ui.writeLine("removing " + this.outputPath);
    return fsp.remove(this.outputPath);
  }

  fetchCurrentVersion() {
    const bucket = this.configBucket;
    const key = this.configKey;

    this.ui.writeLine(
      "fetching current app version from " + bucket + "/" + key
    );

    const stream = this.readStream(bucket, key);

    return this.streamToPromise(stream).then((data) => {
      let config = JSON.parse(data);
      this.ui.writeLine("got config", config);

      this.appBucket = config.bucket;
      this.appKey = config.key;
      this.zipPath = path.basename(config.key);
      this.outputPath = outputPathFor(this.zipPath);
    });
  }

  readStream(bucket, key) {
    const file = storage.bucket(bucket).file(key);
    return file.createReadStream();
  }

  streamToPromise(stream) {
    return new Promise(function (resolve, reject) {
      let data = "";
      stream
        .on("error", reject)
        .on("data", (chunk) => (data += chunk))
        .on("end", function () {
          resolve(data);
        });
    });
  }

  downloadAppZip() {
    return new Promise((res, rej) => {
      const bucket = this.appBucket;
      const key = this.appKey;

      const zipPath = this.zipPath;
      const file = fs.createWriteStream(zipPath);
      const stream = this.readStream(bucket, key);

      this.ui.writeLine(
        "saving gcloud Storage object " + bucket + "/" + key + " to " + zipPath
      );

      stream.pipe(file).on("close", res).on("error", rej);
    });
  }

  unzipApp() {
    const zipPath = this.zipPath;

    return this.exec("unzip " + zipPath).then(() => {
      this.ui.writeLine("unzipped " + zipPath);
    });
  }

  installNPMDependencies() {
    return this.exec(`cd ${this.outputPath} && npm install`)
      .then(() => this.ui.writeLine("installed npm dependencies"))
      .catch(() => this.ui.writeError("unable to install npm dependencies"));
  }

  exec(command) {
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.ui.writeError(`error running command ${command}`);
          this.ui.writeError(stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

function outputPathFor(zipPath) {
  const name = path.basename(zipPath, ".zip");

  // Remove MD5 hash
  return name.split("-").slice(0, -1).join("-");
}

module.exports = GCloudStorageDownloader;
