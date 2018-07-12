# Javacord JavaDoc Proxy 
A small proxy written in NodeJS used to easily access JavaDocs for Javacord.

## I just want to use Javacord :\(
In this case you are wrong here. Just head over to the [Javacord repository](https://github.com/Javacord/Javacord).

## What does this do?
Javacord's Teamcity server ([https://ci.javacord.org/](https://ci.javacord.org/)) generates JavaDocs
for every commit on GitHub and every released version. These links aren't that easy to access though,
as they look like this: 
```
https://ci.javacord.org/repository/download/Javacord_PublishSnapshots/3853:id/javacord-api/javacord-api-3.0.0-SNAPSHOT-javadoc.jar%21/overview-summary.html
```
This proxy "coverts" these ugly urls into more user-friendly ones like this:
```
https://docs.javacord.org/api/build/3853
```

## How to run it?
If you want to run this yourself for whatever reason, you can use Docker:
```
git clone https://github.com/Javacord/Javadoc-Proxy.git
cd Javadoc-Proxy
docker build -t javadoc_proxy .
docker run --rm -d -p 8080:80 --name javadoc_proxy javadoc_proxy
```