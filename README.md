# FastBoot Google Storage Downloader

This downloader for the FastBoot App Server works with Google Storage to download and unzip the latest version of your deployed application.

To use the downloader, configure it with an Google Storage bucket and key:

```js
let downloader = new GCloudStorageDownloader({
  bucket: GOOGLE_STORAGE_BUCKET,
  key: GOOGLE_STORAGE_KEY
});

let server = new FastBootAppServer({
  downloader: downloader
});
```

When the downloader runs, it will download the file at the specified bucket and key. That file should be a JSON file that points at the real application, and looks like this:

```json
{
  "bucket": "GOOGLE_STORAGE_BUCKET",
  "key": "path/to/dist.zip"
}
```

Once downloaded, this file is parsed to find the location of the actual app bundle, which should be a zip file somewhere else on Google Storage.

Why this layer of indirection? By configuring the app server to look in a static location on 
, you don't need to propagate config changes to all of your app servers when you deploy a new version. Instead, they can just grab a fixed file to determine the current version.

If you like this, you may also be interested in the companion [fastboot-gcloud-storage-notifier](https://github.com/EmberSherpa/fastboot-gcloud-storage-notifier).
