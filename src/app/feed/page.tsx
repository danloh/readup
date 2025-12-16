'use client';

import FeedPage from './components/FeedPage';
import NavBar from '../NavBar';

export default function Library() {
  return (<NavBar tab={'feed'} >{FeedPage()}</NavBar>);
}
