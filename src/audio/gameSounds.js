// Connects what happens in the game to the sounds and buzzes that go with it.

export function attachGameSounds(game, { sfx, haptics, music }) {
  game.on((type, data) => {
    switch (type) {
      case 'call':
        sfx.play('ball-land');
        break;
      case 'lock':
        sfx.play('number-flick'); // the number flies into its pill as the marks lock
        break;
      case 'skip':
        sfx.play('ball-skip');
        haptics.buzz(8);
        break;
      case 'mark':
        sfx.play('mark-pop');
        haptics.buzz(8);
        break;
      case 'unmark':
        sfx.play('mark-undo');
        haptics.buzz(5);
        break;
      case 'shout':
        sfx.play('claim-whoosh');
        break;
      case 'tooSlow':
        sfx.play('too-slow');
        break;
      case 'build':
        sfx.play('check-build'); // the slow, dramatic last number
        break;
      case 'reveal':
        sfx.stop('check-build'); // the build-up stops dead as the answer arrives
        if (data.ok) {
          sfx.play('check-tick', { rate: 1 + 0.06 * ((data.count ?? 1) - 1) }); // each tick a little higher
          haptics.buzz(10);
        } else {
          sfx.play('check-cross');
          haptics.buzz([40, 50, 40]);
        }
        break;
      case 'falseCall':
        if (game.falseCall?.reason === 'noPattern') sfx.play('false-call'); // no cross to show, so the wah-wah
        break;
      case 'end':
        if (data?.outcome === 'tooManyWrong') sfx.play('false-call');
        if (data?.outcome === 'win') {
          sfx.play('win-fanfare');
          haptics.buzz([60, 60, 60, 60, 120]);
        }
        break;
      case 'stageWon':
        if (data?.winner?.type === 'you') {
          sfx.play('win-fanfare');
          haptics.buzz([60, 60, 60, 60, 120]);
        } else {
          sfx.play('claim-whoosh'); // a regular shouted
          haptics.buzz(20);
        }
        break;
      case 'pause':
        sfx.play('pause-on');
        music?.duck(true);
        break;
      case 'countdown':
        sfx.play('countdown-beep');
        break;
      case 'resume':
        sfx.play('countdown-go');
        music?.duck(false);
        break;
      default:
    }
  });
}
