import {
  Card,
  Box,
  CardContent,
  CardHeader,
  ToggleButton,
  Tooltip,
  tooltipClasses,
  Button,
  Stack,
  CircularProgress, Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import BackgroundImage from '../assets/images/background.jpg'

import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { useTranslation} from 'react-i18next';
import { Module } from '../types/Module';

import DeleteIcon from '../components/icons/DeleteIcon';
import LaunchIcon from '../components/icons/LaunchIcon';
import TerminalIcon from '../components/icons/TerminalIcon';

import ActionConfirmation from '../components/ActionConfirmation';
import { ModuleInstance } from '../assets/module/module';
import throwExpression from '../common/throwExpression';
import useConfig from '../hooks/useConfig';
import { zipInputReader } from './dataInput';
import demoData from '../assets/module/demo.zip?url';
import GlobeIcon from '../components/icons/GlobeIcon';
import UploadIcon from '../components/icons/UploadIcon';
import FolderIcon from "../components/icons/FolderIcon.tsx";
import ZipIcon from "../components/icons/ZipIcon.tsx";
import DemoIcon from "../components/icons/DemoIcon.tsx";

export default () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const config = useConfig();

  const [instance, setInstance] = useState<Module>();
  const [readyToRun, setReadyToRun] = useState(false);
  const [mainRunning, setMainRunning] = useState(false);
  const [hasData, setHasData] = useState(false);

  const [showConsole, setShowConsole] = useState(import.meta.env.DEV)
  const [messages, setMessages] = useState<Array<string>>([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadTimer, setDownloadTimer] = useState(0);
  const pushMessage = (msg: string) => setMessages(messages => {
    if (msg === 'Running...') return messages;
    messages.reverse().length = Math.min(messages.length, 200);
    return [...messages.reverse(), msg]
  });

  const [langAnchorEl, setLangAnchorEl] = useState<HTMLElement>();
  const [uploadAnchorEl, setUploadAnchorEl] = useState<HTMLButtonElement>();

  const [openDeleteConfirmation, setOpenDeleteConfirmation] = useState(false)

  const [logbox, canvas, directoryInput, zipInput] = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLCanvasElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  useEffect(() => {
    if (!readyToRun || !instance || mainRunning) return;

  }, [readyToRun, instance, mainRunning]);

  useEffect(() => {
    if (!instance) return;
    const handler = () => {
      if (document.hidden) {
        instance.SDL2?.audioContext.suspend();
      } else {
        instance.SDL2?.audioContext.resume();
      }
    }
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [instance]);

  useEffect(() => {
    if (!hasData || !instance) return;
    instance.print(t(`Data bundle looks ok. Continue initialization...`))

    instance.FS.syncfs(false, err => {
      if (err) return instance.print(t('error.Failed to sync FS'));
      instance.FS.chdir(`${instance?.ENV.HOME}`);
      setReadyToRun(true);
      return true;
    })

  }, [hasData, instance]);

  useEffect(() => {
    logbox.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  }, [showConsole, messages]);

  useEffect(function critical () {//init wasm module instance
    if ((critical as any)['lock']) return;
    (critical as any)['lock'] = true;
    pushMessage(t(`Starting wasm module...`));

    (async () => {
      if (!canvas.current) return;
      ModuleInstance({
        ENV: {
          HOME: '/corsixth',
        },
        canvas: canvas.current,
        gameReady: () => console.log('ready'),
        pushMessage,
        reportDownloadProgress: () => {},
        onExit: (code) => {
          console.info('!+EXIT+!', code);
          if (import.meta.env.PROD) {
            console.log('wasm terminated')
          }
        }
      }).then(setInstance)
        .catch((e: Error) => {
          pushMessage(t(`error.WASM module start failed`));
          console.error(e);
        })
    })()

  }, [canvas])

  useEffect(() => {
    if (!instance) return;
    Object.assign(window,  { instance });//debug purposes
    instance.print(t(`Looking up data in [{{path}}]`, { path: instance.ENV.HOME }));

    setReadyToRun(true);
    if (instance.FS.analyzePath(`${instance.ENV.HOME}/ThemeHospital`).exists) return setHasData(true);

  }, [instance])

  const clearPath = (basePath: string) => {
    if (!instance) return;
    try {
      Object.entries(instance.FS.lookupPath(basePath).node.contents).forEach(([path, { isFolder }]) => {
        instance.print(`Clearing ${basePath}/${path}`)
        isFolder
            ? clearPath(`${basePath}/${path}`)
            : instance.FS.unlink(`${basePath}/${path}`)
      })
      instance.FS.rmdir(`${basePath}`)
    } catch (err) {
      instance.print(`Failed to remove stored data`)
      console.error(err)
    }
  };

  const removeData = () => {
    setOpenDeleteConfirmation(true);
  }

  const runInstance = () => {
    if (!instance || mainRunning) return;
    try {
      instance.callMain([`--interpreter=${instance.ENV.HOME}/CorsixTH.lua`]);
    }
    catch (e) {
      console.log(e);
    }
    setMainRunning(true);
    setShowConsole(false);
  }

  const fetchDemoData = () => {
    if (!instance) return;
    instance.print(`Fetching demo data from [${demoData}]`)
    fetch(demoData)
      .then(res => res.blob())
      .then(blob => zipInputReader(`${instance.ENV.HOME}/ThemeHospital`, instance, blob))
      .then(setHasData)
      .catch(e => instance.print(`Failed to get demo version: ${e?.message ?? 'unknow error'}`))
      .finally(() => setReadyToRun(true))
  }


  return (
    <Card
      elevation={0}
      sx={{
        position: 'relative',
        border: '1px solid',
        borderRadius: 1,
        borderColor: theme.palette.divider,
      }}
    >
      <CardHeader
        slotProps={{
          title: { variant: 'subtitle1' }
        }}
        title={''}
        sx={{ p: '8px 12px', height: '44px', '& .MuiCardHeader-action': { width: '100%' } }}
        action={<>
          <Stack direction={"row"} spacing={2}>
            <Tooltip title='Language' slotProps={{ popper: { sx: {
                  [`&.${tooltipClasses.popper}[data-popper-placement*="bottom"] .${tooltipClasses.tooltip}`]: { marginTop: '0px', color: '#000', fontSize: '1em' }
                } }}}>
              <ToggleButton value={-1} selected={Boolean(langAnchorEl)} sx={{ p: '3px 6px', height: '36px' }} onClick={e => setLangAnchorEl(e.currentTarget)}>
                <GlobeIcon width="2.4em" height="2.4em" />
              </ToggleButton>
            </Tooltip>
            <Menu open={Boolean(langAnchorEl)} anchorEl={langAnchorEl} onClose={() => setLangAnchorEl(undefined)}>
              <MenuItem onClick={() => { config.onChangeLocalization('ru-RU'); setLangAnchorEl(undefined) }} disabled={!zipInput.current} sx={{fontSize: '10px', textDecoration: config.i18n === 'ru-RU' ? 'underline' : '' }}>RU</MenuItem>
              <MenuItem onClick={() => { config.onChangeLocalization('en-US'); setLangAnchorEl(undefined) }} disabled={!directoryInput.current} sx={{fontSize: '10px', textDecoration: config.i18n === 'en-US' ? 'underline' : ''}}>EN</MenuItem>
            </Menu>
            <Box flex={1} />
            {!readyToRun && <CircularProgress color="warning" size="34px" />}
            {readyToRun && hasData && !mainRunning && <Button
                sx={{ fontSize: '1em', height: '36px' }}
                variant="contained"
                onClick={() => runInstance()}
            ><LaunchIcon width="2.4em" height="2.4em" style={{ margin: '0 1em 0 0' }} /> {t('menu.Run')}</Button>}
            {readyToRun && hasData && !mainRunning && <Button
              sx={{ fontSize: '1em', height: '36px' }}
              variant="contained"
              onClick={() => removeData()}
            ><DeleteIcon width="2.4em" height="2.4em" style={{ margin: '0 1em 0 0' }} /> {t('menu.Remove data')}</Button>}
            {readyToRun && !hasData && <Button
                sx={{ fontSize: '1em', height: '36px' }}
                variant="contained"
                onClick={e => setUploadAnchorEl(e.currentTarget)}
            >
                <UploadIcon width="2.4em" height="2.4em" style={{ margin: '0 1em 0 0' }} />{t('menu.Add game data')}
            </Button>}
            <Menu open={Boolean(uploadAnchorEl)} anchorEl={uploadAnchorEl} onClose={() => setUploadAnchorEl(undefined)}>
              <MenuItem onClick={() => { zipInput.current?.click(); setUploadAnchorEl(undefined) }} disabled={!zipInput.current} sx={{fontSize: '10px'}}>
                <ListItemIcon><ZipIcon width="2.4em" height="2.4em" style={{ margin: '0 1em 0 0' }} /></ListItemIcon>
                <ListItemText>{t('menu.Select zip archive')}</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { directoryInput.current?.click(); setUploadAnchorEl(undefined) }} disabled={!directoryInput.current} sx={{fontSize: '10px'}}>
                <ListItemIcon><FolderIcon width="2.4em" height="2.4em" style={{ margin: '0 1em 0 0' }} /></ListItemIcon>
                <ListItemText>{t('menu.Select data folder')}</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => { fetchDemoData(); setUploadAnchorEl(undefined) }} sx={{fontSize: '10px'}}>
                <ListItemIcon><DemoIcon width="2.4em" height="2.4em" style={{ margin: '0 1em 0 0' }} /></ListItemIcon>
                <ListItemText>{t('menu.Try demo')}</ListItemText>
              </MenuItem>
            </Menu>
            <Tooltip title={t('menu.Toggle Console')} slotProps={{ popper: { sx: {
                [`&.${tooltipClasses.popper}[data-popper-placement*="bottom"] .${tooltipClasses.tooltip}`]: { marginTop: '0px', color: '#000', fontSize: '1em' }
              } }}}>
                <ToggleButton value={-1} selected={showConsole} sx={{ p: '3px 6px', height: '36px' }} onClick={() => {
                  setShowConsole(!showConsole)
                }}>
                  <TerminalIcon width="2.4em" height="2.4em" />
              </ToggleButton>
            </Tooltip>
          </Stack>
        </>}
      />
      <input
        ref={directoryInput}
        style={{ display: 'none' }}
        type="file"
        multiple
        //@ts-ignore
        webkitdirectory={'directory'}
        directory={'directory'}
      />
      <input
        ref={zipInput}
        type="file"
        accept="application/zip"
        style={{ display: 'none' }}
      />
      <CardContent sx={{
        p: 0,
        m: 0,
        background: `url(${BackgroundImage}) center center`,
        backgroundSize: 'cover',
        height: 'calc(100vh - 46px)',
        position: 'relative',
        '&:last-child': {
          paddingBottom: 0
        }}}>
        <Box sx={{
          bgcolor: 'rgba(0, 0, 0, 0.4)',
          height: showConsole ? '100%' : 0,
          width: '100%',
          whiteSpace: 'pre',
          overflowY: 'auto',
          fontFamily: 'Fallout',
          position: 'absolute',
          zIndex: 1000
        }}>
          {messages.join('\n')}
          <div ref={logbox}></div>
        </Box>
        <canvas id="canvas" ref={canvas} style={{
          width: '100%', height: '100%', position: 'absolute', zIndex: 100,
          top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        }}></canvas>
      </CardContent>
      {downloadProgress ? <Box sx={{ position: 'absolute', display: 'inline-flex', zIndex: 120, top: 'calc(100vh / 2 - 100px)', left: 'calc(100vw / 2 - 100px)' }}>
        <CircularProgress variant="indeterminate" value={downloadProgress} size={200} />
        <Box
          sx={{
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            variant="caption"
            fontSize={40}
            fontWeight={'bold'}
            component="div"
            sx={{ color: 'text.primary' }}
          >{`${Math.round(downloadProgress)}%`}</Typography>
          {downloadTimer ? <Typography
              variant="subtitle1"
              component="div"
              sx={{ color: 'text.primary' }}
          >{`${downloadTimer.toFixed(2)} c`}</Typography> : <Typography
            variant="subtitle1"
            component="div"
            sx={{ color: 'text.primary' }}
          >{Math.round(downloadProgress) === 100 ? 'Unpacking' : 'Downloading'}</Typography>}
        </Box>
      </Box> : ''}
      <ActionConfirmation
        open={openDeleteConfirmation}
        title={t('confirm.Are you sure?')}
        handleClose={(status) => {
          setOpenDeleteConfirmation(false);
          if (!status || !instance) return;

          clearPath(`${instance.ENV.HOME}`);
          instance.FS.syncfs(false, err => {
            if (err) return instance.print(`Failed to remove data at [${instance.ENV.HOME}]`);
            setHasData(false)
            setShowConsole(true)
          });

        }}
        color="error" />
    </Card>
  )
}
