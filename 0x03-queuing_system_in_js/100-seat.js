const redis = require('redis');
const { promisify } = require('util');

const client = redis.createClient();
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);

async function reserveSeat(number) {
    await setAsync('available_seats', number);
}

async function getCurrentAvailableSeats() {
    const numberOfAvailableSeats = await getAsync('available_seats');
    return { numberOfAvailableSeats };
}

const kue = require('kue');

const queue = kue.createQueue();

const express = require('express');
const app = express();

app.listen(1245, () => {
  console.log('Server listening on port 1245');
});

app.get('/available_seats', async (req, res) => {
    const numberOfAvailableSeats = await getCurrentAvailableSeats();
    res.json(numberOfAvailableSeats);
});

let reservationEnabled = true;
let jobId = 0;

app.get('/reserve_seat', async (req, res) => {
  if (!reservationEnabled) {
    res.json({ status: 'Reservation are blocked' });
    return;
  }

  const job = queue.create('reserve_seat', {}).save((err) => {
    if (err) {
      res.json({ status: 'Reservation failed' });
    } else {
      res.json({ status: 'Reservation in process' });
      jobId = job.id;
    }
  });
});

app.get('/process', async (req, res) => {
    res.json({ status: 'Queue processing' });
  
    queue.process('reserve_seat', async (job, done) => {
      const numberOfAvailableSeats = await getCurrentAvailableSeats();
      const newNumberOfAvailableSeats = numberOfAvailableSeats - 1;
  
      if (newNumberOfAvailableSeats === 0) {
        reservationEnabled = false;
      }
  
      if (newNumberOfAvailableSeats >= 0) {
        await reserveSeat(newNumberOfAvailableSeats);
        console.log(`Seat reservation job ${job.id} completed`);
        done();
      } else {
        console.log(`Seat reservation job ${job.id} failed: Not enough seats available`);
        done(new Error('Not enough seats available'));
      }
    });
  });
  
