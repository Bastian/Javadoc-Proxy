FROM node:8

RUN mkdir -p /usr/src/app
RUN mkdir /usr/src/app/private
WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
COPY package.json /usr/src/app/
RUN npm install
COPY . /usr/src/app

RUN npm install

CMD node index.js

EXPOSE 80
