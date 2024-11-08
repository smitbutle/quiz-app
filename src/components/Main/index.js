import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Container,
  Segment,
  Item,
  Button,
  Message,
  Dropdown,
  Divider,
} from 'semantic-ui-react';

import mindImg from '../../images/mind.svg';

import { CATEGORIES, COUNTDOWN_TIME } from '../../constants';
import { shuffle } from '../../utils';

import Offline from '../Offline';

const TEST_CONFIGS = CATEGORIES.map(category => ({
  key: category.key,
  text: category.text,
  value: category.value,
}));

const Main = ({ startQuiz }) => {
  const [selectedTest, setSelectedTest] = useState(null);
  const [countdownTime] = useState({ hours: 0, minutes: 10, seconds: 0 });
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);

  const fetchData = () => {
    setProcessing(true);

    if (error) setError(null);

    const API = `https://opentdb.com/api.php?amount=10&category=${selectedTest}&difficulty=easy&type=multiple`;

    fetch(API)
      .then(response => response.json())
      .then(data =>
        setTimeout(() => {
          const { response_code, results } = data;

          if (response_code === 1) {
            const message = (
              <p>
                The API doesn't have enough questions for this category.
                <br />
                <br />
                Please select a different category.
              </p>
            );

            setProcessing(false);
            setError({ message });

            return;
          }

          results.forEach(element => {
            element.options = shuffle([
              element.correct_answer,
              ...element.incorrect_answers,
            ]);
          });

          setProcessing(false);
          startQuiz(results, countdownTime.hours*60*60 + countdownTime.minutes*60 + countdownTime.seconds);
        }, 1000)
      )
      .catch(error =>
        setTimeout(() => {
          if (!navigator.onLine) {
            setOffline(true);
          } else {
            setProcessing(false);
            setError(error);
          }
        }, 1000)
      );
  };

  if (offline) return <Offline />;

  return (
    <Container>
      <Segment>
        <Item.Group divided>
          <Item>
            <Item.Image src={mindImg} />
            <Item.Content>
              <Item.Header>
                <h1>The Ultimate Trivia Quiz</h1>
              </Item.Header>
              {error && (
                <Message error onDismiss={() => setError(null)}>
                  <Message.Header>Error!</Message.Header>
                  {error.message}
                </Message>
              )}
              <Divider />
              <Item.Meta>
                <p>Select a Quiz Test to Begin:</p>
                <Dropdown
                  fluid
                  selection
                  placeholder="Select Test Category"
                  options={TEST_CONFIGS}
                  value={selectedTest}
                  onChange={(e, { value }) => setSelectedTest(value)}
                  disabled={processing}
                />
              </Item.Meta>
              <Divider />
              <Item.Extra>
                <Button
                  primary
                  size="big"
                  icon="play"
                  labelPosition="left"
                  content={processing ? 'Processing...' : 'Start Test'}
                  onClick={fetchData}
                  disabled={!selectedTest || processing}
                />
              </Item.Extra>
            </Item.Content>
          </Item>
        </Item.Group>
      </Segment>
      <br />
    </Container>
  );
};

Main.propTypes = {
  startQuiz: PropTypes.func.isRequired,
};

export default Main;
